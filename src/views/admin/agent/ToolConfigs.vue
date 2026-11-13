<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { agentToolAdmin, type AgentToolConfig, type KnowledgeScope, type ToolPolicy } from '@/api/agentToolAdmin'
import KnowledgeScopeEditor from '@/components/agent/admin/KnowledgeScopeEditor.vue'
import SearchCredentialEditor from '@/components/agent/admin/SearchCredentialEditor.vue'
import ToolPolicyEditor from '@/components/agent/admin/ToolPolicyEditor.vue'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'

const configs = shallowRef<AgentToolConfig[]>([]) // 最近确认的后台快照。
const policies = shallowRef<ToolPolicy[]>([]) // 最近确认的工具策略。
const loading = shallowRef(false) // 列表读取状态。
const pending = shallowRef('') // 当前等待 CAS 结果的工具名。
const error = shallowRef('') // 安全失败信息。
const confirmation = shallowRef('') // 保存成功后向页面和读屏提示。
const knowledge = computed(() => configs.value.find(item => item.name === 'knowledge_search')) // 目录与检索的共享配置。
const search = computed(() => configs.value.find(item => item.name === 'web_search')) // 搜索供应商凭据配置。
const lifetime = new AbortController() // 离开管理页时取消列表读取。
onUnmounted(() => lifetime.abort())

/** 刷新配置和依赖状态，允许管理员核对并发更新。 */
async function refresh() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([
      agentToolAdmin.list(lifetime.signal).then(items => { configs.value = items }),
      agentToolAdmin.policies(lifetime.signal).then(items => { policies.value = items })
    ])
  } catch (cause) {
    if (!lifetime.signal.aborted) error.value = knowledgeError(cause)
  } finally {
    loading.value = false
  }
}

/** 保存 config 的显式修改，成功后才替换可见的已保存状态。 */
async function update(config: AgentToolConfig, change: Parameters<typeof agentToolAdmin.update>[1], success: string) {
  if (pending.value || loading.value) return false
  pending.value = config.name
  error.value = ''
  confirmation.value = ''
  try {
    const saved = await agentToolAdmin.update(config, change)
    configs.value = configs.value.map(item => item.name === saved.name ? saved : item)
    confirmation.value = success
    return true
  } catch (cause) {
    error.value = knowledgeError(cause)
    return false
  } finally {
    pending.value = ''
  }
}

/** 保存知识范围，保留原工具开关。 */
function saveScope(scope: KnowledgeScope) {
  if (knowledge.value) void update(knowledge.value, { knowledge_scope: scope }, '知识库检索范围已保存')
}

/** key 仅用于当次请求，null 表示清除。 */
async function saveSearchKey(key: string | null) {
  if (!search.value) return false
  return key === null ?
    update(search.value, { credential_action: 'clear' }, 'DeepSeek API Key 已清除') :
    update(search.value, { credential_action: 'replace', api_key: key }, 'DeepSeek API Key 已保存，可在工具列表开启网页搜索')
}

/** 根据 policy 的当前修订保存完整 value。 */
async function savePolicy(policy: ToolPolicy, value: ToolPolicy['value']) {
  if (pending.value || loading.value) return
  pending.value = policy.key
  error.value = ''
  confirmation.value = ''
  try {
    const saved = await agentToolAdmin.updatePolicy(policy, value)
    policies.value = policies.value.map(item => item.key === saved.key ? saved : item)
    confirmation.value = '工具策略已保存'
  } catch (cause) {
    error.value = knowledgeError(cause)
  } finally {
    pending.value = ''
  }
}
onMounted(refresh)
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-head">
      <div>
        <h1 class="admin-page-title">工具管理</h1>
        <p class="admin-page-description">配置前端大师可使用的工具及知识范围。设置在下一次发送时生效。</p>
      </div>
      <a-button :loading="loading" :disabled="!!pending" @click="refresh">刷新状态</a-button>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <p v-if="confirmation" class="tool-confirmation" role="status">{{ confirmation }}</p>
    <a-spin :spinning="loading">
      <a-list :data-source="configs" bordered>
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.label" :description="item.ready ? item.name : (item.reason || '依赖尚未就绪')" />
            <a-switch :aria-label="item.label" :checked="item.enabled" :loading="pending === item.name"
              :disabled="loading || !!pending" checked-children="开启" un-checked-children="关闭"
              @change="(enabled: boolean) => update(item, { enabled }, `${item.label}已${enabled ? '启用' : '关闭'}`)" />
          </a-list-item>
        </template>
      </a-list>
    </a-spin>
    <SearchCredentialEditor v-if="search" :config="search" :busy="loading || !!pending" :save="saveSearchKey" />
    <KnowledgeScopeEditor v-if="knowledge?.knowledge_scope" :scope="knowledge.knowledge_scope"
      :busy="loading || !!pending" :saving="pending === knowledge.name" @save="saveScope" />
    <ToolPolicyEditor :policies="policies" :busy="loading || !!pending" @save="savePolicy" />
  </section>
</template>

<style scoped>
.tool-confirmation { margin: 0; color: #237804; }
</style>
