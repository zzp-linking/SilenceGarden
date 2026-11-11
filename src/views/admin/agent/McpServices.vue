<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { V2HttpError } from '@/api/clientV2'
import { agentMcpAdmin, type McpService, type McpServiceChange, type McpTool } from '@/api/agentMcpAdmin'
import McpServiceEditor from '@/components/agent/admin/McpServiceEditor.vue'

const services = shallowRef<McpService[]>([]) // 最近确认的后台列表。
const active = shallowRef<McpService>() // 当前服务的最新 CAS 快照。
const editing = shallowRef<McpService>() // 表单初始快照，发现和授权不会清除正在编辑的草稿。
const tools = shallowRef<McpTool[]>([]) // 当前已发布目录。
const busy = shallowRef('') // 当前页面操作，同一页面串行提交管理命令。
const error = shallowRef('') // 请求失败的安全提示。
const notice = shallowRef('') // 已确认的操作反馈。
const lifetime = new AbortController() // 离开页面时只取消后台读取。
onUnmounted(() => lifetime.abort())

const options = computed(() => services.value.map(item => ({ label: item.display_name, value: item.id })))
const currentDiscovery = computed(() => !!active.value && active.value.discovered_connection_revision === active.value.connection_revision)
const approvedCount = computed(() => tools.value.filter(tool => tool.approved && tool.status === 'available').length)
const statusLabels = { available: '可用', missing: '已缺失', incompatible: '不兼容' }
const discoveryLabels: Record<string, string> = {
  mcp_auth_failed: '远端拒绝鉴权，请核对服务凭据',
  mcp_network_failed: '无法完成远端连接，请核对网络与出站策略',
  mcp_protocol_error: '未收到可用的 MCP 协议响应',
  mcp_protocol_unsupported: '协商的协议版本或 Tools 能力不受支持',
  mcp_credential_unavailable: '请补齐凭据并检查部署密钥',
  mcp_endpoint_denied: '当前部署出站策略拒绝该端点',
  mcp_session_capacity: '活动 MCP 会话已达上限，请稍后再试',
  mcp_result_too_large: '远端发现响应超过字节上限',
  mcp_discovery_limit: '工具数或分页超出发现上限',
  mcp_invalid_directory: '目录包含重复工具、重复游标或不安全字段'
}

/** 用服务端已确认状态更新列表和当前选中项。 */
function accept(service: McpService) {
  active.value = service
  services.value = services.value.some(item => item.id === service.id)
    ? services.value.map(item => item.id === service.id ? service : item)
    : [...services.value, service]
}

/** 读取同一修订的服务和工具清单，resetForm 仅用于用户主动刷新、切换或保存。 */
async function load(id: string, resetForm: boolean) {
  const signal = lifetime.signal
  for (let attempt = 0; attempt < 2; attempt++) {
    const [service, directory] = await Promise.all([agentMcpAdmin.get(id, signal), agentMcpAdmin.tools(id, signal)])
    if (service.revision !== directory.revision) continue
    accept(service)
    tools.value = directory.items
    if (resetForm) editing.value = service
    return
  }
  throw new Error('服务正在被其他管理员更新，请刷新后再试。')
}

/** 串行执行页面操作，业务失败保留已有目录供核对。 */
async function perform(action: string, operation: () => Promise<void>) {
  if (busy.value) return
  busy.value = action
  error.value = ''
  notice.value = ''
  try {
    await operation()
  } catch (reason) {
    if (lifetime.signal.aborted) return
    const code = reason instanceof V2HttpError ? reason.apiError.details?.discovery_error : undefined
    error.value = typeof code === 'string' && discoveryLabels[code]
      ? discoveryLabels[code]
      : reason instanceof Error ? reason.message : '操作失败，请刷新后重试。'
    if (action === 'discover' && typeof code === 'string' && active.value) {
      // 发现失败也会推进修订，重新读取保留的上次成功清单。
      try { await load(active.value.id, false) } catch { /* 保留原始错误，管理员可手动刷新。 */ }
    }
  } finally {
    busy.value = ''
  }
}

/** 刷新列表和当前详情，更新表单所依据的服务修订。 */
function refresh() {
  return perform('refresh', async () => {
    const id = active.value?.id
    services.value = (await agentMcpAdmin.list(lifetime.signal)).items
    if (id) await load(id, true)
  })
}

/** 切换服务会读取新的管理快照。 */
function select(id: string) { return perform('select', () => load(id, true)) }

/** 清空当前选择，开始录入默认停用的新服务。 */
function startNew() {
  if (busy.value) return
  active.value = undefined
  editing.value = undefined
  tools.value = []
  error.value = ''
  notice.value = ''
}

/** 凭据仅从当前事件传给保存请求，页面不保存凭据草稿。 */
function save(change: McpServiceChange) {
  return perform('save', async () => {
    const current = active.value
    // 发现失败后的自动读取可能看到其他管理员的新配置，旧表单不能覆盖它。
    if (current && (!editing.value || current.connection_revision !== editing.value.connection_revision ||
      current.display_name !== editing.value.display_name || current.timeout_ms !== editing.value.timeout_ms)) {
      throw new Error('连接配置已变更，请刷新后重新编辑。')
    }
    const saved = current ? await agentMcpAdmin.save(current, change) : await agentMcpAdmin.create(change)
    accept(saved)
    editing.value = saved
    await load(saved.id, true)
    notice.value = '连接配置已保存。'
  })
}

/** 只测试已保存的连接，成功后用完整目录替换旧清单。 */
function discover() {
  const service = active.value
  if (!service) return
  return perform('discover', async () => {
    const found = await agentMcpAdmin.discover(service)
    accept(found.service)
    tools.value = found.items
    notice.value = '发现清单已刷新，请核对逐工具授权。'
  })
}

/** 核对当前发现签名后授权或撤权一个工具。 */
function approve(tool: McpTool, approved: boolean) {
  const service = active.value
  if (!service) return
  return perform('approve', async () => {
    const updated = await agentMcpAdmin.approve(service, tool.id, approved)
    accept({ ...service, revision: updated.revision })
    tools.value = tools.value.map(item => item.id === tool.id ? updated.tool : item)
    notice.value = approved ? '工具已授权。' : '工具授权已撤销。'
  })
}

/** 启停仅修改后台开关，下一次接纳会读取新配置。 */
function toggle() {
  const service = active.value
  if (!service) return
  return perform('toggle', async () => {
    const updated = await agentMcpAdmin.enable(service, !service.enabled)
    accept(updated)
    notice.value = updated.enabled ? '服务已启用。' : '服务已停用。'
  })
}

/** 格式化最近成功发现时间，沿用浏览器的本地时区。 */
function localTime(value: string) { return new Date(value).toLocaleString('zh-CN') }

onMounted(refresh)
</script>

<template>
  <section class="mcp-page" aria-labelledby="mcp-page-title">
    <header class="mcp-header">
      <div><h2 id="mcp-page-title">MCP 管理</h2><p>配置外部服务、发现可用工具并逐项授权。</p></div>
      <a-space wrap>
        <a-button :disabled="!!busy" @click="startNew">新增 MCP 服务</a-button>
        <a-button :disabled="!!busy" :loading="busy === 'refresh'" @click="refresh">刷新</a-button>
      </a-space>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-alert v-if="notice" type="success" show-icon :message="notice" role="status" />
    <a-card size="small">
      <label for="mcp-service">已配置服务</label>
      <a-select id="mcp-service" class="mcp-service-select" :value="active?.id" :options="options"
        :disabled="!!busy" :loading="busy === 'select' || busy === 'refresh'" placeholder="选择服务" @update:value="select" />
      <span v-if="!services.length && !busy" class="mcp-muted">暂无服务，可在下方新增。</span>
    </a-card>
    <a-card :title="active ? '1. 连接配置' : '新增服务 · 连接配置'">
      <McpServiceEditor :service="editing" :busy="!!busy" @save="save" />
    </a-card>
    <template v-if="active">
      <a-card title="2. 测试并发现">
        <div class="mcp-status">
          <a-tag v-if="active.enabled" color="green">已启用</a-tag>
          <a-tag v-else>已停用</a-tag>
          <a-tag v-if="currentDiscovery" color="blue">当前配置已发现</a-tag>
          <a-tag v-else color="orange">等待发现</a-tag>
          <a-tag v-if="currentDiscovery && !approvedCount" color="orange">等待授权</a-tag>
          <a-tag v-if="active.discovery_error" color="red">最近发现失败</a-tag>
        </div>
        <p v-if="active.discovered_at" class="mcp-muted">
          上次发现成功于 {{ localTime(active.discovered_at) }} · 协商版本 {{ active.protocol_version }}
        </p>
        <p v-if="active.discovery_error" class="mcp-muted">{{ discoveryLabels[active.discovery_error] ?? active.discovery_error }}</p>
        <a-button :disabled="!!busy" :loading="busy === 'discover'" @click="discover">测试已保存连接并发现工具</a-button>
      </a-card>
      <a-card title="3. 工具授权">
        <p class="mcp-muted">当前有 {{ approvedCount }} 个可用工具已授权。请核对工具输入、数据去向和远端副作用。</p>
        <a-empty v-if="!tools.length" description="暂无工具清单，请先测试并发现。" />
        <a-list v-else :data-source="tools">
          <template #renderItem="{ item }: { item: McpTool }">
            <a-list-item>
              <div class="mcp-tool">
                <div class="mcp-tool-heading">
                  <div><strong>{{ item.raw_name }}</strong> <a-tag>{{ statusLabels[item.status] }}</a-tag></div>
                  <a-checkbox :checked="item.approved" :disabled="!!busy || item.status !== 'available' || !currentDiscovery"
                    :aria-label="`授权 ${item.raw_name}`" @update:checked="(approved: boolean) => approve(item, approved)">授权</a-checkbox>
                </div>
                <div class="mcp-muted"><code>{{ item.model_name }}</code></div>
                <p v-if="item.description">{{ item.description }}</p>
                <details><summary>查看输入 Schema</summary><pre>{{ JSON.stringify(item.input_schema, null, 2) }}</pre></details>
              </div>
            </a-list-item>
          </template>
        </a-list>
      </a-card>
      <a-card title="4. 启用服务">
        <p class="mcp-muted">启停和授权变更从下一次发送生效。聊天用户还需开启本轮 MCP 工具授权。</p>
        <a-button :type="active.enabled ? 'default' : 'primary'" :disabled="!!busy || (!active.enabled && (!currentDiscovery || !approvedCount))"
          :loading="busy === 'toggle'" @click="toggle">{{ active.enabled ? '停用服务' : '启用服务' }}</a-button>
      </a-card>
    </template>
  </section>
</template>

<style scoped>
.mcp-page { display: grid; gap: 16px; max-width: 1100px; }
.mcp-header, .mcp-tool-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }
.mcp-header h2, .mcp-header p { margin: 0; }
.mcp-header p, .mcp-muted { color: #595959; }
.mcp-service-select { width: min(100%, 330px); margin: 4px 12px; }
.mcp-status { display: flex; flex-wrap: wrap; row-gap: 6px; margin-bottom: 12px; }
.mcp-tool { width: 100%; min-width: 0; overflow-wrap: anywhere; }
.mcp-tool p { white-space: pre-wrap; margin: 4px 0; }
.mcp-tool summary { cursor: pointer; margin-top: 4px; }
.mcp-tool pre { overflow: auto; max-height: 240px; padding: 8px; background: #f5f5f5; }
</style>
