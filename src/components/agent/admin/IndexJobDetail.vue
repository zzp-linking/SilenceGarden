<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { agentIndexAdminApi, type IndexJobDetail, type IndexJobItem } from '@/api/agentIndexAdmin'
import { knowledgeError, useKnowledgePage } from '@/composables/agent/useKnowledgePage'
import { useIndexPolling } from '@/composables/agent/useIndexPolling'
import { useIndexCommand } from '@/composables/agent/useIndexCommand'
import IndexJobCounts from './IndexJobCounts.vue'
import IndexCommandFeedback from './IndexCommandFeedback.vue'
import KnowledgePager from './KnowledgePager.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** jobId：当前选中的持久化任务 ID，重试须继承它的原始意图。 */
  jobId: string;
  /** accepting：服务端与本地状态共同确认是否允许接纳新的索引命令。 */
  accepting: boolean
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** submitted：命令已确认接纳，请父级刷新任务与运行状态。 */
  submitted: []
}>()
/** detail：当前任务详情与不可变提交快照。 */
const detail = shallowRef<IndexJobDetail | null>(null)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** loading：当前读取请求的加载状态，仅允许最新请求更新。 */
const loading = shallowRef(false)
/** command：本组件独占的幂等写入状态，保留结果不确定时的原始请求。 */
const command = useIndexCommand()
/** page：当前面板独占的游标读取状态，筛选变化后从首页重新加载。 */
const page = useKnowledgePage((cursor, signal) => agentIndexAdminApi.items(props.jobId, { cursor }, signal))
/** columns：表格列定义，业务事实由各行的服务端数据提供。 */
const columns = [{ title: '文档', key: 'document' }, { title: '执行与进度', key: 'progress' }, { title: '结果', key: 'result' }, { title: '操作', key: 'actions' }]
/** labels：持久化状态对应的中文展示文案。 */
const labels: Record<string, string> = { queued: '排队', running: '执行中', succeeded: '成功', failed: '失败', interrupted: '中断', skipped: '无需重建', completed_with_errors: '已结束 · 有失败或中断' }
/** phases：流水线阶段对应的中文展示文案，阶段进度不作为激活成功依据。 */
const phases: Record<string, string> = { queued: '排队', validate: '校验来源', parse: '解析', split: '切分', embed: '向量化', activate: '激活', completed: '完成', unchanged: '无需重建' }
// 保留提交时的 Book 名称，改名或解散后仍能理解历史范围；管理界面只展示所需快照，不倾倒内部 JSON 与档案字段。
const books = computed(() => {
  const value = detail.value?.target_snapshot.books
  return Array.isArray(value) ? value.filter((b): b is {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** name：供管理员展示和维护的名称。 */
  name: string
} => typeof b === 'object' && b !== null && typeof b.id === 'string' && typeof b.name === 'string') : []
})
/** epoch：递增的本地请求代号，筛选、路由或生命周期改变后使旧响应失效。 */
let epoch = 0
/** controller：当前读取的取消控制器，新请求或卸载时中止旧读取。 */
let controller: AbortController | undefined
onScopeDispose(() => { epoch++; controller?.abort() })
/** load 读取当前任务详情，新任务或卸载使旧响应失效。 */
async function load() {
  const ticket = ++epoch
  controller?.abort(); controller = new AbortController(); loading.value = true; error.value = ''
  try { const value = await agentIndexAdminApi.job(props.jobId, controller.signal); if (ticket === epoch) detail.value = value }
  catch (reason) { if (ticket === epoch) error.value = knowledgeError(reason) }
  finally { if (ticket === epoch) loading.value = false }
}
/** reload 并行重读任务详情和当前成员页，保持状态来自服务端。 */
async function reload() { await Promise.all([load(), page.reload()]) }
watch(() => props.jobId, () => { detail.value = null; void load(); void page.first() }, { immediate: true })
useIndexPolling(() => !!detail.value && detail.value.counts.queued + detail.value.counts.running > 0, async () => { if (!loading.value && !page.loading.value) await reload() })
/**
 * retry 显式重放已冻结的命令，复用原幂等键，成功后通知父级刷新。
 * @param item 当前任务中选定的失败或中断成员。
 */
async function retry(item: IndexJobItem) {
  if (!props.accepting || item.document_deleted || !['failed', 'interrupted'].includes(item.state)) return
  const itemID = item.id, origin = props.jobId
  // 重试从当前选定的不可变来源 job 继承 build/force。多个 job 共享同一失败 item 时，也不能从 item 推断命令意图。
  if (await command.run(key => agentIndexAdminApi.retry(itemID, origin, key))) emit('submitted')
}
/** repeat 显式重放同一待核对命令，保留其原始请求键和目标快照。 */
async function repeat() { if (await command.retry()) emit('submitted') }
/** reviewed 管理员核对服务端结果后，清除本地待核对请求并允许后续操作。 */
function reviewed() { command.reviewed(); void reload(); emit('submitted') }
</script>
<template>
  <a-card title="任务详情" :bordered="false"><template #extra><a-button :loading="loading" @click="reload">刷新任务详情</a-button></template><a-alert v-if="error || page.error.value" type="error" show-icon :message="error || page.error.value" /><template v-if="detail"><p class="admin-mono">{{ detail.id }}</p><a-space wrap><a-tag>{{ detail.mode === 'force' ? '强制重建' : '建立索引' }}</a-tag><strong>{{ labels[detail.state] }}</strong></a-space><p v-if="books.length">提交时 Book：{{ books.map(b => b.name).join('、') }}</p><p v-if="detail.origin_job_id"><RouterLink :to="`/admin/agent/index-jobs/${detail.origin_job_id}`">查看重试来源任务</RouterLink></p><IndexJobCounts :counts="detail.counts" /><p class="admin-muted">共享条目展示同一份执行事实；重试新建任务，保留原任务结果，并继承此任务的{{ detail.mode === 'force' ? '强制重建' : '普通建立' }}意图。</p></template><a-table row-key="id" :columns="columns" :data-source="page.data.value.items" :loading="page.loading.value" :pagination="false" :scroll="{ x: 760 }"><template #bodyCell="{ column, record }"><template v-if="column.key === 'document'"><strong>{{ record.title }}</strong><p v-if="record.document_deleted">文档或知识库已删除</p><RouterLink v-else :to="`/admin/agent/knowledge-bases/${record.knowledge_base_id}`">来源知识库</RouterLink><p class="admin-mono">{{ record.document_id }}</p></template><template v-else-if="column.key === 'progress'"><a-tag>{{ labels[record.state] }}</a-tag><p>{{ phases[record.phase] || record.phase }} · {{ record.completed_chunks }}/{{ record.total_chunks }} 片段</p><span v-if="record.shared_job_count > 1">{{ record.shared_job_count }} 个任务引用此条目</span></template><template v-else-if="column.key === 'result'"><span>{{ record.error_message || (record.state === 'skipped' ? '相同索引已经生效' : '—') }}</span></template><template v-else-if="column.key === 'actions'"><a-button v-if="['failed', 'interrupted'].includes(record.state)" :disabled="!accepting || command.busy.value || !!command.requestKey.value || record.document_deleted || !!error" @click="retry(record)">按本任务意图重试</a-button></template></template></a-table><KnowledgePager :previous="page.canPrevious.value" :next="!!page.data.value.next_cursor" :busy="page.loading.value" :page="page.index.value" @previous="page.previous" @next="page.next" /><IndexCommandFeedback :busy="command.busy.value" :error="command.error.value" :request-key="command.requestKey.value" :job="command.job.value" @retry="repeat" @reviewed="reviewed" /></a-card>
</template>
