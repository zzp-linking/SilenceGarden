<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { McpAuthMode, McpCredentialAction, McpQueryChange, McpService, McpServiceChange } from '@/api/agentMcpAdmin'

const { service, busy } = defineProps<{
  service?: McpService // 当前开始编辑时的安全配置快照，缺省表示新增。
  busy: boolean // 页面正在读取或提交管理命令。
}>()
const emit = defineEmits<{
  save: [change: McpServiceChange] // 仅此事件会传出待保存的凭据。
}>()

/** 查询行只持有当前表单草稿，稳定行键不受参数改名影响。 */
interface QueryRow {
  key: number // 只用于编辑器渲染。
  name: string // 将提交的参数名。
  secret: boolean // 保密行用凭据动作。
  value: string // 普通查询参数值。
  hasCredential: boolean // 已保存值的安全标记。
  action: McpCredentialAction // 本次行凭据动作。
  credential: string // 待提交值，提交后清空。
}

let nextKey = 0 // 在同一编辑器生命周期内为动态行分配键。
const form = reactive({
  key: '', displayName: '', endpoint: '', authMode: 'none' as McpAuthMode,
  authName: '', timeout: 10000 as number | null, action: 'keep' as McpCredentialAction,
  credential: '', query: [] as QueryRow[]
}) // 编辑器独占草稿与仅写凭据输入。

const authOptions = [
  { label: '无鉴权', value: 'none' }, { label: 'Bearer', value: 'bearer' },
  { label: '自定义请求头', value: 'header' }, { label: '保密查询参数', value: 'query' }
]
const actions = [
  { label: '保留', value: 'keep' }, { label: '替换', value: 'replace' }, { label: '清除', value: 'clear' }
]
const newSecretActions = [
  { label: '填写保密值', value: 'replace' }, { label: '稍后填写', value: 'keep' }
] // 新保密行默认填写，也可明确保存为待补齐状态。
const usesHeader = computed(() => form.authMode === 'header' || form.authMode === 'bearer')
const credentialsNeedReview = computed(() => !!service &&
  (service.endpoint !== form.endpoint.trim() || service.auth_mode !== form.authMode ||
    form.authMode === 'header' && (service.auth_name ?? '') !== form.authName.trim().toLowerCase()))
const canSave = computed(() => /^[a-z][a-z0-9_]{0,23}$/.test(form.key.trim()) && !!form.displayName.trim() &&
  !!form.endpoint.trim() && form.timeout != null && Number.isInteger(form.timeout) &&
  form.timeout >= 1000 && form.timeout <= 30000 &&
  (form.authMode !== 'header' || !!form.authName.trim()) &&
  (!usesHeader.value || form.action !== 'replace' || !!form.credential.trim()) &&
  (form.authMode !== 'query' || form.query.some(row => row.secret)) &&
  form.query.every(row => row.name.trim() && (!row.secret || row.action !== 'replace' || row.credential.trim())) &&
  new Set(form.query.map(row => row.name.trim())).size === form.query.length)

/** 从安全快照恢复表单，凭据输入始终为空。 */
watch(() => service, config => {
  form.key = config?.service_key ?? ''
  form.displayName = config?.display_name ?? ''
  form.endpoint = config?.endpoint ?? ''
  form.authMode = config?.auth_mode ?? 'none'
  form.authName = config?.auth_name ?? ''
  form.timeout = config?.timeout_ms ?? 10000
  form.action = 'keep'
  form.credential = ''
  form.query = (config?.query_params ?? []).map(param => ({
    key: ++nextKey, name: param.name, value: param.value ?? '', secret: !!param.secret,
    hasCredential: !!param.has_credential, action: param.secret && !param.has_credential ? 'replace' : 'keep', credential: ''
  }))
}, { immediate: true })

/** 切换模式时清理已隐藏的凭据，避免随之后的保存提交。 */
function changeMode(mode: McpAuthMode) {
  form.authMode = mode
  form.action = 'keep'
  form.credential = ''
  if (mode !== 'query') form.query = form.query.filter(row => !row.secret)
}

/** 新建参数行，保密行初始可留空以保存停用配置。 */
function addRow() {
  form.query.push({ key: ++nextKey, name: '', value: '', secret: false, hasCredential: false, action: 'keep', credential: '' })
}

/** 转为保密时将普通草稿移入密码框，反向切换时丢弃保密值。 */
function changeRowType(row: QueryRow, secret: boolean) {
  row.credential = secret ? row.value : ''
  row.action = secret ? 'replace' : 'keep'
  row.secret = secret
  row.value = ''
  row.hasCredential = false
}

/** 序列化当前表单，凭据只在 replace 时出现在事件载荷中。 */
function submit() {
  if (!canSave.value || busy || form.timeout == null) return
  const query: McpQueryChange[] = form.query.map(row => row.secret ?
    { name: row.name.trim(), secret: true, credential_action: row.action, credential: row.action === 'replace' ? row.credential : undefined } :
    { name: row.name.trim(), value: row.value })
  const change: McpServiceChange = {
    service_key: service ? undefined : form.key.trim(),
    display_name: form.displayName.trim(), transport: 'streamable_http', endpoint: form.endpoint.trim(),
    auth_mode: form.authMode, auth_name: form.authMode === 'header' ? form.authName.trim() : undefined,
    query_params: query, timeout_ms: form.timeout,
    credential_action: usesHeader.value ? form.action : undefined,
    credential: usesHeader.value && form.action === 'replace' ? form.credential : undefined
  }
  form.credential = ''
  for (const row of form.query) row.credential = ''
  emit('save', change)
}
</script>

<template>
  <a-form :model="form" layout="vertical" :disabled="busy" autocomplete="off" @finish="submit">
    <div class="mcp-fields">
      <a-form-item label="服务键" html-for="mcp-key" required extra="保存后固定，用于生成模型工具名。">
        <a-input id="mcp-key" v-model:value="form.key" :maxlength="24" :disabled="!!service" placeholder="例如 baidu_map" />
      </a-form-item>
      <a-form-item label="显示名称" html-for="mcp-name" required>
        <a-input id="mcp-name" v-model:value="form.displayName" :maxlength="120" />
      </a-form-item>
    </div>
    <a-form-item label="服务端点" html-for="mcp-endpoint" required extra="Streamable HTTP 基础地址。请将查询参数填在下方。">
      <a-input id="mcp-endpoint" v-model:value="form.endpoint" :maxlength="2048" placeholder="https://mcp.example.com/mcp" />
    </a-form-item>
    <div class="mcp-fields">
      <a-form-item label="鉴权方式" html-for="mcp-auth" required>
        <a-select id="mcp-auth" :value="form.authMode" :options="authOptions" @update:value="changeMode" />
      </a-form-item>
      <a-form-item label="调用超时（毫秒）" html-for="mcp-timeout" required>
        <a-input-number id="mcp-timeout" v-model:value="form.timeout" :min="1000" :max="30000" :step="1000" />
      </a-form-item>
      <a-form-item v-if="form.authMode === 'header'" label="请求头名称" html-for="mcp-header" required>
        <a-input id="mcp-header" v-model:value="form.authName" :maxlength="64" placeholder="X-API-Key" />
      </a-form-item>
      <a-form-item v-if="usesHeader" label="服务凭据" html-for="mcp-credential-action" :extra="service?.has_credential ? '已保存凭据' : '尚未保存凭据'">
        <a-select id="mcp-credential-action" v-model:value="form.action" :options="actions" />
      </a-form-item>
      <a-form-item v-if="usesHeader && form.action === 'replace'" label="新服务凭据" html-for="mcp-credential" required>
        <a-input-password id="mcp-credential" v-model:value="form.credential" autocomplete="new-password" :maxlength="4096" />
      </a-form-item>
    </div>
    <a-alert v-if="credentialsNeedReview" type="info" show-icon
      message="端点或鉴权字段变更后，请重新填写仍需使用的凭据，或选择清除后保存为停用配置。" />

    <div class="mcp-query-heading">
      <div><h4>查询参数</h4><p>使用查询鉴权时，请把 AK 等凭据标为保密参数，在密码框中填写。</p></div>
      <a-button :disabled="form.query.length >= 16" @click="addRow">添加参数</a-button>
    </div>
    <fieldset v-for="(row, index) in form.query" :key="row.key" class="mcp-query-row">
      <legend>参数 {{ index + 1 }}</legend>
      <div class="mcp-fields">
        <a-form-item label="参数名" :html-for="`mcp-query-name-${row.key}`" required>
          <a-input :id="`mcp-query-name-${row.key}`" v-model:value="row.name" :maxlength="128" />
        </a-form-item>
        <a-form-item v-if="form.authMode === 'query'" label="保密设置">
          <a-checkbox :checked="row.secret" @update:checked="(value: boolean) => changeRowType(row, value)">保密参数</a-checkbox>
        </a-form-item>
        <a-form-item v-if="!row.secret" label="参数值" :html-for="`mcp-query-value-${row.key}`">
          <a-input :id="`mcp-query-value-${row.key}`" v-model:value="row.value" :maxlength="2048" />
        </a-form-item>
        <a-form-item v-else label="凭据操作" :html-for="`mcp-query-action-${row.key}`" :extra="row.hasCredential ? '已保存凭据' : '尚未保存凭据'">
          <a-select :id="`mcp-query-action-${row.key}`" v-model:value="row.action" :options="row.hasCredential ? actions : newSecretActions" />
        </a-form-item>
        <a-form-item v-if="row.secret && row.action === 'replace'" label="参数值（加密保存）" :html-for="`mcp-query-secret-${row.key}`" required>
          <a-input-password :id="`mcp-query-secret-${row.key}`" v-model:value="row.credential" autocomplete="new-password" :maxlength="4096" />
        </a-form-item>
      </div>
      <a-button danger size="small" :aria-label="`移除参数 ${index + 1}`" @click="form.query.splice(index, 1)">移除</a-button>
    </fieldset>
    <a-button html-type="submit" type="primary" :disabled="!canSave" :loading="busy">保存连接配置</a-button>
  </a-form>
</template>

<style scoped>
.mcp-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 0 16px; }
.mcp-query-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin: 12px 0; }
.mcp-query-heading h4, .mcp-query-heading p { margin: 0; }
.mcp-query-heading p { color: #595959; }
.mcp-query-row { min-width: 0; border: 1px solid #d9d9d9; border-radius: 6px; padding: 0 12px 12px; margin: 0 0 12px; }
.mcp-query-row legend { float: none; width: auto; font-size: 14px; margin: 0; padding: 0 4px; }
</style>
