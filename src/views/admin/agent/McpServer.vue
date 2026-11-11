<script setup lang="ts">
import { onMounted, onScopeDispose, reactive, shallowRef } from 'vue'
import { mcpServerAdmin, mcpServerError, type McpServerService } from '@/api/agentMcpServerAdmin'
import McpServerKeys from '@/components/agent/admin/McpServerKeys.vue'
import McpServerLogs from '@/components/agent/admin/McpServerLogs.vue'

const services = shallowRef<McpServerService[]>([]) // 最近读取的服务及修订。
const ready = shallowRef(false) // 已取得服务清单，可以编辑授权。
const protocolAvailable = shallowRef<boolean>() // 当前实例是否成功装配 MCP 协议。
const loading = shallowRef(false) // 服务列表读取状态。
const saving = shallowRef(false) // 当前设置提交状态。
const error = shallowRef('') // 服务列表读取错误。
const editError = shallowRef('') // 设置弹窗提交错误。
const selected = shallowRef<McpServerService>() // 设置弹窗的原始修订快照。
const edit = reactive({ enabled: false, timeout_ms: 10000 as number | null, max_concurrency: 2 as number | null })
const tab = shallowRef('services') // 当前管理页签。
const logKey = shallowRef('') // 从 Key 列表跳转时预填的筛选值。
const lifetime = new AbortController() // 只读请求与当前路由生命周期绑定。

/** 刷新服务启停、限制及本机运行可用性。 */
async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await mcpServerAdmin.services(lifetime.signal)
    services.value = result.items
    protocolAvailable.value = result.protocol_available
    ready.value = true
  } catch (reason) {
    if (lifetime.signal.aborted) return
    ready.value = false
    error.value = mcpServerError(reason)
  } finally {
    loading.value = false
  }
}

/** 编辑基于当前行的独立设置草稿。 */
function open(service: McpServerService) {
  selected.value = service
  Object.assign(edit, { enabled: service.enabled, timeout_ms: service.timeout_ms, max_concurrency: service.max_concurrency })
  editError.value = ''
}

/** 保存并更新服务行，发生修订冲突时刷新列表供下次读取。 */
async function save() {
  const service = selected.value
  const { enabled, timeout_ms, max_concurrency } = edit
  if (!service || saving.value) return
  if (timeout_ms === null || max_concurrency === null || !Number.isInteger(timeout_ms) || !Number.isInteger(max_concurrency)) {
    editError.value = '请输入整数超时和并发上限。'
    return
  }
  saving.value = true
  editError.value = ''
  try {
    // 启停状态没变化时只提交限制，协议不可用期间仍可维护已有设置。
    const updated = await mcpServerAdmin.saveService(service.service_key, {
      enabled: enabled === service.enabled ? undefined : enabled,
      timeout_ms,
      max_concurrency,
      revision: service.revision,
    })
    if (lifetime.signal.aborted) return
    services.value = services.value.map(item => item.service_key === updated.service_key ? updated : item)
    selected.value = undefined
  } catch (reason) {
    if (lifetime.signal.aborted) return
    editError.value = mcpServerError(reason)
    await refresh()
  } finally {
    saving.value = false
  }
}

/** 转到调用记录并预填所选 Key 的 UUID。 */
function showLogs(id: string) {
  logKey.value = id
  tab.value = 'logs'
}

onMounted(refresh)
onScopeDispose(() => lifetime.abort())
</script>

<template>
  <section class="mcp-server-page" aria-labelledby="mcp-server-title">
    <header>
      <h2 id="mcp-server-title">MCP 对外服务</h2>
      <p>向持有 API Key 的客户端开放已授权的只读工具。</p>
    </header>
    <a-alert v-if="protocolAvailable === false" class="protocol-alert" type="error" show-icon
      message="MCP 对外协议入口未就绪，请检查服务端配置。服务启用和发钥暂不可用。" />
    <a-tabs v-model:active-key="tab">
      <a-tab-pane key="services" tab="服务">
        <a-card size="small" title="已注册服务">
          <template #extra><a-button size="small" :loading="loading" @click="refresh">刷新</a-button></template>
          <a-alert v-if="error" class="section-alert" type="error" show-icon :message="error" />
          <a-spin :spinning="loading">
            <a-empty v-if="!services.length && !error" description="暂无注册服务" />
            <a-list v-else :data-source="services">
              <template #renderItem="{ item }: { item: McpServerService }">
                <a-list-item>
                  <a-list-item-meta :description="item.description">
                    <template #title>{{ item.display_name }} <code>{{ item.service_key }}</code></template>
                  </a-list-item-meta>
                  <a-space wrap class="service-actions">
                    <a-tag :color="item.enabled ? 'green' : undefined">{{ item.enabled ? '已启用' : '已停用' }}</a-tag>
                    <a-tag v-if="protocolAvailable === false" color="red">协议入口未就绪</a-tag>
                    <a-tag v-else-if="!item.available" color="red">执行依赖不可用</a-tag>
                    <a-tag v-else-if="!item.retrieval_available" color="orange">检索暂不可用</a-tag>
                    <span>{{ item.timeout_ms }} ms · 并发 {{ item.max_concurrency }}</span>
                    <a-button :disabled="!ready" @click="open(item)">设置</a-button>
                  </a-space>
                </a-list-item>
              </template>
            </a-list>
          </a-spin>
        </a-card>
      </a-tab-pane>
      <a-tab-pane key="keys" tab="API Key">
        <McpServerKeys :services="services" :services-ready="ready" :issue-disabled="protocolAvailable === false" @show-logs="showLogs" />
      </a-tab-pane>
      <a-tab-pane key="logs" tab="调用日志">
        <McpServerLogs :selected-key-id="logKey" />
      </a-tab-pane>
    </a-tabs>

    <a-modal :open="!!selected" :title="`服务设置 · ${selected?.display_name ?? ''}`" ok-text="保存" cancel-text="取消"
      :confirm-loading="saving" :closable="!saving" :mask-closable="false" :keyboard="!saving" :cancel-button-props="{ disabled: saving }"
      @ok="save" @cancel="selected = undefined">
      <a-alert v-if="editError" class="section-alert" type="error" show-icon :message="editError" />
      <a-form layout="vertical">
        <a-form-item label="允许对外调用">
          <a-switch v-model:checked="edit.enabled" :disabled="protocolAvailable === false && !selected?.enabled" aria-label="允许对外调用" />
        </a-form-item>
        <a-form-item label="检索超时（毫秒）" html-for="mcp-timeout">
          <a-input-number id="mcp-timeout" v-model:value="edit.timeout_ms" :min="1000" :max="10000" :precision="0" />
        </a-form-item>
        <a-form-item label="全局检索并发" html-for="mcp-concurrency">
          <a-input-number id="mcp-concurrency" v-model:value="edit.max_concurrency" :min="1" :max="64" :precision="0" />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.mcp-server-page { max-width: 1320px; }
.mcp-server-page header h2 { margin: 0 0 4px; }
.mcp-server-page header p { margin: 0; color: #595959; }
.section-alert { margin-bottom: 16px; }
.protocol-alert { margin-top: 16px; }
.service-actions { justify-content: flex-end; }
@media (max-width: 640px) {
  .service-actions { justify-content: flex-start; }
  .mcp-server-page :deep(.ant-list-item) { align-items: flex-start; flex-direction: column; gap: 10px; }
}
</style>

