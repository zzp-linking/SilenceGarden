<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, shallowRef } from 'vue'
import { mcpServerAdmin, mcpServerError, type McpKeyFields, type McpServerKey, type McpServerService } from '@/api/agentMcpServerAdmin'
import { mcpDateInput, mcpLocalTime, useMcpServerPage } from '@/composables/useMcpServerPage'

const props = defineProps<{
  services: McpServerService[] // 当前代码注册服务。
  servicesReady: boolean // 是否已有可信授权编辑清单。
  issueDisabled: boolean // 协议入口不可用时禁用创建及轮换发钥。
}>()
const emit = defineEmits<{ showLogs: [keyID: string] }>() // 让路由页切换到该 Key 的日志。
const { items, loading, error, previous, nextCursor, search, refresh, back, next } = useMcpServerPage(mcpServerAdmin.keys)
const filters = reactive({ title: '', consumer_label: '', status: undefined as string | undefined, service_key: undefined as string | undefined })
const operation = shallowRef<'create' | 'edit' | 'grants' | 'revoke' | 'detail'>() // 管理弹窗当前用途。
const target = shallowRef<McpServerKey>() // 打开弹窗时重读的安全快照。
const rotation = shallowRef<McpServerKey>() // 发钥时可选的轮换来源。
const draft = reactive({ title: '', consumer: '', note: '', expiry: '', rate: null as number | null })
const grantKeys = shallowRef<string[]>([]) // 授权弹窗独立草稿。
const actionNote = shallowRef('') // 授权备注或撤销原因。
const busy = shallowRef(false) // 写入期间锁定弹窗和管理动作。
const reading = shallowRef(false) // 正在获取最新详情。
const failure = shallowRef('') // 当前操作错误。
const notice = shallowRef('') // 保存或复制结果提示。
const secret = shallowRef('') // 一次性明文，仅存活至发钥提示关闭。
const copyStatus = shallowRef('') // 剪贴板操作结果。
const lifetime = new AbortController() // 路由离开时终止详情读取。

const statusLabels = { active: '有效', expired: '已过期', revoked: '已撤销' }
const statusColors = { active: 'green', expired: 'orange', revoked: 'red' }
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }))
const serviceOptions = computed(() => props.services.map(item => ({ value: item.service_key, label: item.display_name })))
const titles = { create: '创建 API Key', edit: '修改 API Key', grants: '服务授权', revoke: '撤销 API Key', detail: 'API Key 详情' }

/** 把筛选草稿应用到列表，分页继续使用同一筛选快照。 */
function applyFilters() {
  return search({ ...filters, title: filters.title.trim(), consumer_label: filters.consumer_label.trim() })
}

/** 根据已知服务显示授权，历史服务保留原始稳定键。 */
function serviceLabel(key: string) {
  return props.services.find(service => service.service_key === key)?.display_name ?? key
}

/** 将安全元数据复制到独立表单，避免本地编辑直接改动表格行。 */
function fillDraft(key?: McpServerKey) {
  Object.assign(draft, {
    title: key?.title ?? '',
    consumer: key?.consumer_label ?? '',
    note: key?.note ?? '',
    expiry: mcpDateInput(key?.expires_at ?? null),
    rate: key?.requests_per_minute ?? null,
  })
}

/** 开始发放新 Key，轮换时预填合作方信息并保留旧 Key。 */
function openCreate(oldKey?: McpServerKey) {
  if (props.issueDisabled) return
  target.value = undefined
  rotation.value = oldKey
  fillDraft(oldKey)
  if (oldKey) {
    draft.title = Array.from(oldKey.title).slice(0, 116).join('') + '（轮换）'
    draft.expiry = ''
  }
  operation.value = 'create'
  failure.value = ''
  notice.value = ''
}

/** 打开管理弹窗前读取最新修订，防止提交过期行的状态。 */
async function openKey(key: McpServerKey, action: 'edit' | 'grants' | 'revoke' | 'detail') {
  if (reading.value || busy.value) return
  reading.value = true
  failure.value = ''
  notice.value = ''
  try {
    const current = await mcpServerAdmin.key(key.id, lifetime.signal)
    if (lifetime.signal.aborted) return
    target.value = current
    fillDraft(current)
    grantKeys.value = current.service_keys.filter(service => props.services.some(item => item.service_key === service))
    actionNote.value = ''
    operation.value = current.status === 'revoked' ? 'detail' : action
  } catch (reason) {
    if (!lifetime.signal.aborted) failure.value = mcpServerError(reason)
  } finally {
    reading.value = false
  }
}

/** 序列化表单字段，编辑时保留未触碰时间的原始精度。 */
function keyFields(current?: McpServerKey): McpKeyFields | undefined {
  const title = draft.title.trim()
  const expiry = draft.expiry ? new Date(draft.expiry) : null
  if (!title || expiry && !Number.isFinite(expiry.getTime()) ||
      draft.rate !== null && (!Number.isInteger(draft.rate) || draft.rate < 1 || draft.rate > 2147483647)) {
    failure.value = '请填写标题并核对到期时间和每分钟额度。'
    return
  }
  return {
    title,
    consumer_label: draft.consumer.trim() || null,
    note: draft.note.trim() || null,
    expires_at: current && draft.expiry === mcpDateInput(current.expires_at) ? current.expires_at : expiry?.toISOString() ?? null,
    requests_per_minute: draft.rate,
  }
}

/** 关闭安全详情或编辑弹窗并丢弃草稿快照。 */
function close() {
  operation.value = undefined
  target.value = undefined
  rotation.value = undefined
  failure.value = ''
}

/** 提交一次管理命令。明文只进入独立的发钥提示。 */
async function save() {
  const mode = operation.value
  const current = target.value
  if (busy.value || !mode) return
  if (mode === 'detail') { close(); return }
  failure.value = ''
  busy.value = true
  try {
    if (mode === 'create' || mode === 'edit') {
      if (mode === 'create' && props.issueDisabled) return
      const fields = keyFields(mode === 'edit' ? current : undefined)
      if (!fields) return
      if (mode === 'create') {
        const issued = await mcpServerAdmin.issue(fields, rotation.value?.id)
        if (lifetime.signal.aborted) return
        secret.value = issued.api_key
        copyStatus.value = ''
      } else if (current) {
        await mcpServerAdmin.saveKey(current, fields)
      }
    } else if (mode === 'grants' && current && props.servicesReady) {
      await mcpServerAdmin.grants(current, grantKeys.value, actionNote.value.trim() || null)
    } else if (mode === 'revoke' && current) {
      await mcpServerAdmin.revoke(current, actionNote.value.trim() || null)
    } else {
      return
    }
    if (lifetime.signal.aborted) return
    close()
    if (mode !== 'create') notice.value = '已保存'
    await refresh()
  } catch (reason) {
    if (!lifetime.signal.aborted) {
      failure.value = mcpServerError(reason)
      await refresh()
    }
  } finally {
    busy.value = false
  }
}

/** 复制当前发钥结果，剪贴板不可用时提示手工选择复制。 */
async function copySecret() {
  if (!secret.value) return
  try {
    await navigator.clipboard.writeText(secret.value)
    if (secret.value) copyStatus.value = '已复制'
  } catch {
    if (secret.value) copyStatus.value = '无法访问剪贴板，请手动选择并复制。'
  }
}

/** 清理一次性明文，返回详情时只能读取掩码。 */
function clearSecret() {
  secret.value = ''
  copyStatus.value = ''
}

onMounted(applyFilters)
onScopeDispose(() => {
  lifetime.abort()
  clearSecret()
})
</script>

<template>
  <a-card size="small" title="API Key">
    <template #extra>
      <a-button type="primary" :disabled="issueDisabled || reading || busy" @click="openCreate()">创建 Key</a-button>
    </template>
    <a-form layout="inline" class="key-filters" @finish="applyFilters">
      <a-form-item label="标题" html-for="mcp-key-filter-title">
        <a-input id="mcp-key-filter-title" v-model:value="filters.title" allow-clear />
      </a-form-item>
      <a-form-item label="合作方" html-for="mcp-key-filter-consumer">
        <a-input id="mcp-key-filter-consumer" v-model:value="filters.consumer_label" allow-clear />
      </a-form-item>
      <a-form-item label="状态">
        <a-select v-model:value="filters.status" class="filter-select" :options="statusOptions" allow-clear placeholder="全部" aria-label="筛选状态" />
      </a-form-item>
      <a-form-item label="授权服务">
        <a-select v-model:value="filters.service_key" class="filter-select" :options="serviceOptions" allow-clear placeholder="全部" aria-label="筛选授权服务" />
      </a-form-item>
      <a-button html-type="submit" :loading="loading">筛选</a-button>
    </a-form>

    <a-alert v-if="error || (failure && !operation)" class="key-alert" type="error" show-icon :message="error || failure" />
    <a-alert v-if="notice" class="key-alert" type="success" show-icon :message="notice" role="status" />
    <a-table :data-source="items" :pagination="false" :loading="loading" :scroll="{ x: 930 }" row-key="id" size="small"
      :locale="{ emptyText: '暂无 API Key' }">
      <a-table-column title="标题 / 掩码" key="title">
        <template #default="{ record }: { record: McpServerKey }">
          <strong>{{ record.title }}</strong><div><code>{{ record.key_hint }}</code></div>
        </template>
      </a-table-column>
      <a-table-column title="合作方" key="consumer">
        <template #default="{ record }: { record: McpServerKey }">{{ record.consumer_label || '—' }}</template>
      </a-table-column>
      <a-table-column title="授权服务" key="services">
        <template #default="{ record }: { record: McpServerKey }">
          <a-tag v-for="key in record.service_keys" :key="key">{{ serviceLabel(key) }}</a-tag>
          <span v-if="!record.grant_count">零授权</span>
        </template>
      </a-table-column>
      <a-table-column title="状态" key="status">
        <template #default="{ record }: { record: McpServerKey }">
          <a-tag :color="statusColors[record.status]">{{ statusLabels[record.status] }}</a-tag>
        </template>
      </a-table-column>
      <a-table-column title="最近使用" key="last-used">
        <template #default="{ record }: { record: McpServerKey }">{{ mcpLocalTime(record.last_used_at) }}</template>
      </a-table-column>
      <a-table-column title="操作" key="actions">
        <template #default="{ record }: { record: McpServerKey }">
          <a-space wrap>
            <a-button type="link" size="small" :disabled="reading || busy" @click="openKey(record, 'detail')">详情</a-button>
            <a-button v-if="record.status !== 'revoked'" type="link" size="small" :disabled="!servicesReady || reading || busy"
              @click="openKey(record, 'grants')">授权</a-button>
            <a-button type="link" size="small" :disabled="issueDisabled || reading || busy" @click="openCreate(record)">轮换</a-button>
            <a-button type="link" size="small" @click="emit('showLogs', record.id)">日志</a-button>
          </a-space>
        </template>
      </a-table-column>
    </a-table>
    <a-space class="key-pages">
      <a-button :disabled="loading || !previous.length" @click="back">上一页</a-button>
      <a-button :disabled="loading || !nextCursor" @click="next">下一页</a-button>
      <a-button :loading="loading" @click="refresh">刷新</a-button>
    </a-space>

    <a-modal :open="!!operation" :title="operation ? titles[operation] : ''"
      :ok-text="operation === 'revoke' ? '确认撤销' : '保存'" cancel-text="取消"
      :confirm-loading="busy" :closable="!busy" :mask-closable="false" :keyboard="!busy"
      :cancel-button-props="{ disabled: busy }" :ok-button-props="{ danger: operation === 'revoke', disabled: (operation === 'grants' && !servicesReady) || (operation === 'create' && issueDisabled) }"
      @cancel="close" @ok="save">
      <a-alert v-if="failure" class="key-alert" type="error" show-icon :message="failure" />
      <template v-if="operation === 'detail' && target">
        <a-descriptions :column="1" size="small">
          <a-descriptions-item label="标题">{{ target.title }}</a-descriptions-item>
          <a-descriptions-item label="Key ID"><code>{{ target.id }}</code></a-descriptions-item>
          <a-descriptions-item label="掩码"><code>{{ target.key_hint }}</code></a-descriptions-item>
          <a-descriptions-item label="合作方">{{ target.consumer_label || '—' }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ statusLabels[target.status] }}</a-descriptions-item>
          <a-descriptions-item label="授权">{{ target.service_keys.map(serviceLabel).join('、') || '零授权' }}</a-descriptions-item>
          <a-descriptions-item label="到期时间">{{ mcpLocalTime(target.expires_at) }}</a-descriptions-item>
          <a-descriptions-item label="最近使用">{{ mcpLocalTime(target.last_used_at) }}</a-descriptions-item>
          <a-descriptions-item label="每分钟额度">{{ target.requests_per_minute ?? '部署默认' }}</a-descriptions-item>
          <a-descriptions-item label="备注">{{ target.note || '—' }}</a-descriptions-item>
          <a-descriptions-item v-if="target.rotated_from_key_id" label="轮换来源"><code>{{ target.rotated_from_key_id }}</code></a-descriptions-item>
          <a-descriptions-item v-if="target.revoked_at" label="撤销时间">{{ mcpLocalTime(target.revoked_at) }}</a-descriptions-item>
          <a-descriptions-item v-if="target.revocation_reason" label="撤销原因">{{ target.revocation_reason }}</a-descriptions-item>
        </a-descriptions>
      </template>
      <a-form v-else-if="operation === 'create' || operation === 'edit'" layout="vertical">
        <a-alert v-if="rotation" class="key-alert" type="info" show-icon :message="`轮换 ${rotation.key_hint}。新 Key 从零授权开始，旧 Key 可在联调后手动撤销。`" />
        <a-form-item label="标题" html-for="mcp-key-title" required>
          <a-input id="mcp-key-title" v-model:value="draft.title" :maxlength="120" />
        </a-form-item>
        <a-form-item label="合作方" html-for="mcp-key-consumer">
          <a-input id="mcp-key-consumer" v-model:value="draft.consumer" :maxlength="120" />
        </a-form-item>
        <a-form-item label="到期时间（本地时区）" html-for="mcp-key-expiry">
          <a-input id="mcp-key-expiry" v-model:value="draft.expiry" type="datetime-local" />
        </a-form-item>
        <a-form-item label="每分钟额度" html-for="mcp-key-rate">
          <a-input-number id="mcp-key-rate" v-model:value="draft.rate" :min="1" :max="2147483647" :precision="0" placeholder="部署默认" />
        </a-form-item>
        <a-form-item label="备注" html-for="mcp-key-note">
          <a-textarea id="mcp-key-note" v-model:value="draft.note" :maxlength="1000" :rows="2" />
        </a-form-item>
      </a-form>
      <a-form v-else-if="operation === 'grants'" layout="vertical">
        <a-alert class="key-alert" type="warning" show-icon message="授权知识库服务会开放所有未删除的知识库，包括以后新建的库。" />
        <a-form-item label="授权服务">
          <a-checkbox-group v-model:value="grantKeys" :options="serviceOptions" aria-label="选择授权服务" />
        </a-form-item>
        <a-form-item label="新增授权备注" html-for="mcp-grant-note">
          <a-textarea id="mcp-grant-note" v-model:value="actionNote" :maxlength="1000" :rows="2" />
        </a-form-item>
      </a-form>
      <a-form v-else-if="operation === 'revoke'" layout="vertical">
        <a-alert class="key-alert" type="warning" show-icon :message="`撤销 ${target?.key_hint ?? ''} 后，使用该凭据的新请求会立即失效。`" />
        <a-form-item label="撤销原因" html-for="mcp-revoke-reason">
          <a-textarea id="mcp-revoke-reason" v-model:value="actionNote" :maxlength="400" :rows="2" />
        </a-form-item>
      </a-form>
      <template v-if="operation === 'detail'" #footer>
        <a-space v-if="target">
          <a-button @click="close">关闭</a-button>
          <a-button v-if="target.status !== 'revoked'" @click="operation = 'edit'">修改</a-button>
          <a-button v-if="target.status !== 'revoked'" danger @click="actionNote = ''; operation = 'revoke'">撤销</a-button>
        </a-space>
      </template>
    </a-modal>

    <a-modal :open="!!secret" title="API Key 已创建" :footer="null" :mask-closable="false" @cancel="clearSecret">
      <a-alert class="key-alert" type="info" show-icon message="请现在复制并妥善保存。关闭后只能查看掩码。" />
      <a-input :value="secret" readonly aria-label="新 API Key 明文" autocomplete="off" />
      <a-space class="key-pages">
        <a-button type="primary" @click="copySecret">复制 Key</a-button>
        <a-button @click="clearSecret">关闭</a-button>
        <span role="status">{{ copyStatus }}</span>
      </a-space>
    </a-modal>
  </a-card>
</template>

<style scoped>
.key-filters { row-gap: 8px; margin-bottom: 16px; }
.filter-select { min-width: 110px; }
.key-alert { margin-bottom: 12px; }
.key-pages { margin-top: 16px; }
</style>

