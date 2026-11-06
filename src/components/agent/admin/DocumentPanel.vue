<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { agentAdminApi, type KnowledgeDocument } from '@/api/agentAdmin'
import type { IndexRuntimeState } from '@/api/agentIndexAdmin'
import { knowledgeError, useKnowledgePage } from '@/composables/agent/useKnowledgePage'
import { useIndexPolling } from '@/composables/agent/useIndexPolling'
import DocumentIndexActions from './DocumentIndexActions.vue'
import BookPicker from './BookPicker.vue'
import DocumentEditor from './DocumentEditor.vue'
import KnowledgePager from './KnowledgePager.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** baseId：当前所属知识库 ID，限制所有读取与可选 Book 的范围。 */
  baseId: string;
  /** refreshKey：元数据或 Book 成员变化的刷新代号，避免继续沿用已失效的归属。 */
  refreshKey: number;
  /** activityKey：索引操作后的刷新代号，促使列表重新核对 busy 和执行结果。 */
  activityKey?: number;
  /** runtime：页面持有的安全运行快照，用于判断 active 是否属于当前可服务的模型档案。 */
  runtime?: IndexRuntimeState | null
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** indexed：索引操作发生变化，请父级同步运行状态和摘要。 */
  indexed: []
}>()
/** filters：尚未应用的列表过滤草稿。 */
const filters = reactive({ title: '', tag: '', book: 'all' })
/** applied：本次已提交的筛选快照，与仍可修改的表单输入分开。 */
const applied = shallowRef({ ...filters })
/** page：当前面板独占的游标读取状态，筛选变化后从首页重新加载。 */
const page = useKnowledgePage((cursor, signal) => agentAdminApi.documents(props.baseId, { ...applied.value, cursor }, signal))
/** rows：结合服务端 active、busy 和当前运行档案派生的文档展示行。 */
const rows = computed(() => page.data.value.items.map(doc => {
  const index = doc.index
  const served = !!index?.active_version_id && props.runtime?.retrieval_ready && index.profile_id === props.runtime.profile_id
  const label = !index ? '索引模块未就绪' : index.busy ? (index.active_version_id ? '重建中 · 旧索引保留' : '首次索引排队 / 执行中') : index.active_version_id ? (served ? '可检索' : '索引已生效 · 检索暂停') : '未建立索引'
  // 在途任务仍保留上一次终态记录；仅在当前任务结束后展示最近失败，避免误判新任务失败。
  const indexFailure = !index?.busy ? index?.recent_terminal?.error_message : undefined
  return { ...doc, indexLabel: label, indexColor: index?.busy ? 'blue' : served ? 'green' : 'default', indexFailure }
}))
useIndexPolling(() => page.data.value.items.some(doc => !!doc.index?.busy) || !!props.runtime && props.runtime.queued + props.runtime.running > 0, async () => { if (!page.loading.value) await page.reload() })
watch(() => props.activityKey, () => void page.reload())
/** indexed 索引动作完成后通知父级刷新运行状态与相关列表。 */
function indexed() { if (props.activityKey === undefined) void page.reload(); emit('indexed') }
/** selected：当前编辑或批量提交的选择快照，实际提交时仍由后端校验。 */
const selected = shallowRef<KnowledgeDocument | null>(null)
/** editing：是否显示元数据编辑表单。 */
const editing = shallowRef(false)
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** columns：表格列定义，业务事实由各行的服务端数据提供。 */
const columns = [{ title: '文档 / 固定来源', key: 'document' }, { title: '标签与归属', key: 'metadata' }, { title: '修订', dataIndex: 'revision', width: 80 }, { title: '操作', key: 'actions', width: 240 }]
watch(() => [props.baseId, props.refreshKey], () => {
  // Book 解散后原筛选可能已失效；回到全部文档并从服务器重读修订。
  filters.book = 'all'; applied.value = { ...filters }; editing.value = false; void page.first()
}, { immediate: true })
/** search 将筛选草稿复制为已应用快照，并从第一页重新查询。 */
function search() { applied.value = { ...filters }; void page.first() }
/**
 * edit 编辑前读取最新文档修订；空选择用于创建上传表单。
 * @param value 需要编辑的当前资源快照；null 表示新建。
 */
async function edit(value: KnowledgeDocument | null) {
  if (busy.value) return
  error.value = ''
  if (!value) { selected.value = null; editing.value = true; return }
  busy.value = true
  try { selected.value = await agentAdminApi.document(value.id); editing.value = true }
  catch (reason) { error.value = knowledgeError(reason) }
  finally { busy.value = false }
}
/** closeEditor 关闭编辑表单后重读列表，获取服务端最新修订和索引事实。 */
function closeEditor() { editing.value = false; void page.first() }
/**
 * remove 在元数据修订和索引忙碌门禁下逻辑删除文档，成功后重读首页。
 * @param value 需要校验、保存或操作的当前数据快照。
 */
async function remove(value: KnowledgeDocument) {
  if (busy.value || value.index?.busy) return
  busy.value = true; error.value = ''
  try { await agentAdminApi.removeDocument(value); await page.first() }
  catch (reason) { error.value = knowledgeError(reason) }
  finally { busy.value = false }
}
/**
 * download 读取固定原文件并触发浏览器附件下载，稍后释放临时对象 URL。
 * @param value 需要校验、保存或操作的当前数据快照。
 */
async function download(value: KnowledgeDocument) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    const response = await agentAdminApi.source(value.id)
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url; link.download = value.source.original_name; document.body.appendChild(link); link.click(); link.remove()
    // 点击后延后释放，允许浏览器读取附件；临时 URL 不跨页面长期保存。
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (reason) { error.value = knowledgeError(reason) }
  finally { busy.value = false }
}
</script>
<template>
  <a-card title="文档" :bordered="false">
    <template #extra><a-space wrap><a-button :loading="page.loading.value" :disabled="busy" @click="page.first">刷新文档</a-button><a-button type="primary" :disabled="busy" @click="edit(null)">上传文档</a-button></a-space></template>
    <!-- Ant Design 只有绑定表单模型后才发出 finish，即使未配置校验规则。 -->
    <a-form :model="filters" layout="vertical" class="document-filters" @finish="search">
      <a-form-item label="标题包含"><a-input v-model:value="filters.title" aria-label="标题包含" allow-clear :maxlength="200" /></a-form-item>
      <a-form-item label="标签精确匹配"><a-input v-model:value="filters.tag" aria-label="标签精确匹配" allow-clear :maxlength="40" /></a-form-item>
      <a-form-item label="Book 范围"><BookPicker v-model="filters.book" :base-id="baseId" filter :refresh-key="refreshKey" /></a-form-item>
      <a-form-item label="查询"><a-button html-type="submit" :disabled="busy || page.loading.value">应用筛选</a-button></a-form-item>
    </a-form>
    <a-alert v-if="error || page.error.value" role="alert" type="error" show-icon :message="error || page.error.value" class="document-alert" />
    <a-table row-key="id" :columns="columns" :data-source="rows" :pagination="false" :loading="page.loading.value" :scroll="{ x: 900 }" :locale="{ emptyText: '暂无匹配文档，可上传原文件开始整理' }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'document'"><strong>{{ record.title }}</strong><p class="source-line">{{ record.source.original_name }} · {{ (record.source.byte_size / 1024).toFixed(1) }} KiB</p><a-tag :color="record.indexColor">{{ record.indexLabel }}</a-tag><span v-if="record.index">索引修订 {{ record.index.index_revision }} · {{ record.index.chunk_count }} 片段</span><p v-if="record.indexFailure" class="index-failure">最近构建：{{ record.indexFailure }}</p><DocumentIndexActions :document="record" :accepting="!!runtime?.accepting" @changed="indexed" /></template>
        <template v-else-if="column.key === 'metadata'"><p>{{ record.book_id ? 'Book 文档' : '独立文档' }}</p><a-tag v-for="tag in record.tags" :key="tag">{{ tag }}</a-tag><span v-if="!record.tags.length" class="admin-muted">暂无标签</span></template>
        <template v-else-if="column.key === 'actions'"><a-space wrap><a-button :disabled="busy" @click="edit(record)">维护</a-button><a-button :disabled="busy" @click="download(record)">下载</a-button><a-popconfirm title="删除后不可恢复。原文件保留；正文变化请删除后重新上传。" ok-text="逻辑删除" cancel-text="取消" @confirm="remove(record)"><a-button danger :disabled="busy || record.index?.busy">删除</a-button></a-popconfirm></a-space></template>
      </template>
    </a-table>
    <KnowledgePager :previous="page.canPrevious.value" :next="!!page.data.value.next_cursor" :busy="busy || page.loading.value" :page="page.index.value" @previous="page.previous" @next="page.next" />
    <DocumentEditor v-if="editing" :base-id="baseId" :existing="selected" @saved="closeEditor" @cancel="closeEditor" />
  </a-card>
</template>
<style scoped>
.document-filters { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) minmax(180px, 1fr) auto; gap: 16px; align-items: start; }
.document-alert { margin-bottom: 16px; }.source-line { margin: 8px 0; overflow-wrap: anywhere; }
.index-failure { margin: 8px 0; color: #b42318; }
@media (max-width: 900px) { .document-filters { grid-template-columns: 1fr 1fr; } }
@media (max-width: 540px) { .document-filters { grid-template-columns: 1fr; gap: 0; } }
</style>
