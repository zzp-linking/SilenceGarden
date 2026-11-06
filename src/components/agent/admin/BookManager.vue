<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { agentAdminApi, type KnowledgeBase } from '@/api/agentAdmin'
import { knowledgeError, useKnowledgePage } from '@/composables/agent/useKnowledgePage'
import BaseEditor from './BaseEditor.vue'
import KnowledgePager from './KnowledgePager.vue'
import BookIndexControls from './BookIndexControls.vue'
import { useIndexPolling } from '@/composables/agent/useIndexPolling'
import { useKnowledgeUploadStore } from '@/stores/knowledgeUpload'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** baseId：当前所属知识库 ID，限制所有读取与可选 Book 的范围。 */
  baseId: string;
  /** accepting：服务端与本地状态共同确认是否允许接纳新的索引命令。 */
  accepting?: boolean;
  /** active：当前是否存在在途索引工作，供 Book 忙碌状态持续刷新。 */
  active?: boolean;
  /** activityKey：索引操作后的刷新代号，促使列表重新核对 busy 和执行结果。 */
  activityKey?: number
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** changed：操作结果发生变化，请父级重新核对列表与修订。 */
  changed: [];
  /** indexed：索引操作发生变化，请父级同步运行状态和摘要。 */
  indexed: []
}>()
/** uploadDefaults：按知识库隔离的本标签页上传偏好，只有确认成功后才写入。 */
const uploadDefaults = useKnowledgeUploadStore()
/** page：当前面板独占的游标读取状态，筛选变化后从首页重新加载。 */
const page = useKnowledgePage(cursor => agentAdminApi.books(props.baseId, { cursor }))
/** editing：是否显示元数据编辑表单。 */
const editing = shallowRef(false)
/** selected：当前编辑或批量提交的选择快照，实际提交时仍由后端校验。 */
const selected = shallowRef<KnowledgeBase | null>(null)
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
watch(() => props.baseId, () => { editing.value = false; void page.first() }, { immediate: true })
watch(() => props.activityKey, () => void page.reload())
useIndexPolling(() => !!props.active || page.data.value.items.some(book => !!book.index_busy), async () => { if (!page.loading.value) await page.reload() })
/** indexed 索引动作完成后通知父级刷新运行状态与相关列表。 */
function indexed() { if (props.activityKey === undefined) void page.reload(); emit('indexed') }
/**
 * edit 固定当前编辑资源的快照并打开表单；空选择表示新建。
 * @param value 需要编辑的当前资源快照；null 表示新建。
 */
function edit(value: KnowledgeBase | null) { selected.value = value; editing.value = true }
/** saved 关闭已成功保存的表单，从首页读取最新资源及修订。 */
function saved() { editing.value = false; void page.first(); emit('changed') }
/**
 * dissolve 在元数据修订保护下解散 Book，清理本页上传偏好中的失效归属并刷新列表。
 * @param value 需要校验、保存或操作的当前数据快照。
 */
async function dissolve(value: KnowledgeBase) {
  if (busy.value || value.index_busy) return
  const baseId = props.baseId
  busy.value = true; error.value = ''
  try { await agentAdminApi.removeBase(value, true); uploadDefaults.forgetBook(baseId, value.id); await page.first(); emit('changed') }
  catch (reason) { error.value = knowledgeError(reason) }
  finally { busy.value = false }
}
</script>
<template>
  <a-card title="Book 合集" :bordered="false">
    <template #extra><a-space wrap><a-button :disabled="busy" :loading="page.loading.value" @click="page.first">刷新</a-button><a-button type="primary" :disabled="busy" @click="edit(null)">创建 Book</a-button></a-space></template>
    <a-alert v-if="error || page.error.value" role="alert" type="error" show-icon :message="error || page.error.value" />
    <BookIndexControls :books="page.data.value.items" :accepting="!!accepting" @submitted="indexed" />
    <a-list class="book-list" :loading="page.loading.value" :data-source="page.data.value.items" :locale="{ emptyText: '暂无 Book，可直接上传独立文档' }">
      <template #renderItem="{ item }"><a-list-item><a-list-item-meta :title="item.name" :description="item.description || '暂无说明'" /><template #actions><a-tag v-if="item.index_busy" color="blue">有在途索引</a-tag><a-tag>修订 {{ item.revision }}</a-tag><a-button :disabled="busy" @click="edit(item)">编辑</a-button><a-popconfirm title="解散 Book？所有文档将留在原知识库，成为独立文档。" ok-text="解散 Book" cancel-text="取消" @confirm="dissolve(item)"><a-button danger :disabled="busy || item.index_busy">解散</a-button></a-popconfirm></template></a-list-item></template>
    </a-list>
    <KnowledgePager :previous="page.canPrevious.value" :next="!!page.data.value.next_cursor" :busy="busy || page.loading.value" :page="page.index.value" @previous="page.previous" @next="page.next" />
    <BaseEditor v-if="editing" :parent="baseId" :existing="selected" @saved="saved" @cancel="editing = false; page.first()" />
  </a-card>
</template>
<style scoped>
/* 窄屏把动作放在元数据下方，避免按钮把 Book 名称挤成逐字换行。 */
.book-list :deep(.ant-list-item-meta) { min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .book-list :deep(.ant-list-item) { flex-wrap: wrap; gap: 12px; }
  .book-list :deep(.ant-list-item-meta) { flex: 1 1 100%; }
  .book-list :deep(.ant-list-item-action) { margin-inline-start: 0; }
}
</style>
