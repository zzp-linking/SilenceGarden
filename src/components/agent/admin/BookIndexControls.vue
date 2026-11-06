<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { KnowledgeBase } from '@/api/agentAdmin'
import { agentIndexAdminApi, type IndexMode } from '@/api/agentIndexAdmin'
import { useIndexCommand } from '@/composables/agent/useIndexCommand'
import IndexCommandFeedback from './IndexCommandFeedback.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** books：当前提供给批量选择器的 Book 列表，实际范围由服务端提交时展开。 */
  books: KnowledgeBase[];
  /** accepting：服务端与本地状态共同确认是否允许接纳新的索引命令。 */
  accepting: boolean
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** submitted：命令已确认接纳，请父级刷新任务与运行状态。 */
  submitted: []
}>()
/** selected：当前编辑或批量提交的选择快照，实际提交时仍由后端校验。 */
const selected = shallowRef<string[]>([])
/** command：本组件独占的幂等写入状态，保留结果不确定时的原始请求。 */
const command = useIndexCommand()
// 达到批量上限时只禁用尚未选择的选项，已选项仍可取消。
const options = computed(() => props.books.map(book => ({ value: book.id, label: book.name, disabled: selected.value.length >= 20 && !selected.value.includes(book.id) })))
/** blocked：由写入中、待核对键和运行开关共同派生的交互门禁。 */
const blocked = computed(() => command.busy.value || !!command.requestKey.value || !props.accepting)
watch(() => props.books, books => { const ids = new Set(books.map(b => b.id)); selected.value = selected.value.filter(id => ids.has(id)) })
/**
 * submit 复制所选 Book ID 并固定 build/force 意图，经幂等请求入口提交有界批量命令。
 * @param mode 原始 build/force 构建意图。
 */
async function submit(mode: IndexMode) {
  if (blocked.value || !selected.value.length || selected.value.length > 20) return
  const ids = [...selected.value]
  if (await command.run(key => ids.length === 1 ? agentIndexAdminApi.book(ids[0]!, mode, key) : agentIndexAdminApi.books(ids, mode, key))) emit('submitted')
}
/** retry 显式重放已冻结的命令，复用原幂等键，成功后通知父级刷新。 */
async function retry() { if (await command.retry()) emit('submitted') }
/** reviewed 管理员核对服务端结果后，清除本地待核对请求并允许后续操作。 */
function reviewed() { command.reviewed(); emit('submitted') }
</script>
<template>
  <div class="book-index-controls"><p>选择本页 Book 建立索引，最多 20 个、展开最多 200 篇；按提交时文档快照处理，之后上传的文档不会自动加入。</p><a-space wrap><a-select v-model:value="selected" mode="multiple" :options="options" :max-tag-count="3" :disabled="blocked" placeholder="选择一个或多个 Book" aria-label="建立索引的 Book" class="book-selection" /><a-button :disabled="blocked || !selected.length" @click="submit('build')">建立所选 Book 索引</a-button><a-popconfirm title="强制重建所选 Book 的当前文档？相同在途构建会合并，完成前保留旧索引。" ok-text="强制重建" cancel-text="取消" @confirm="submit('force')"><a-button :disabled="blocked || !selected.length">强制重建所选 Book</a-button></a-popconfirm></a-space><IndexCommandFeedback :busy="command.busy.value" :error="command.error.value" :request-key="command.requestKey.value" :job="command.job.value" @retry="retry" @reviewed="reviewed" /></div>
</template>
<style scoped>.book-index-controls { margin-bottom: 16px; }.book-selection { min-width: min(320px, 100%); width: 320px; max-width: 100%; }</style>
