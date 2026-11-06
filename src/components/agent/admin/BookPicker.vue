<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { agentAdminApi, type KnowledgeBase } from '@/api/agentAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** baseId：当前所属知识库 ID，限制所有读取与可选 Book 的范围。 */
  baseId: string;
  /** disabled：父级交互门禁；忙碌或结果待核对时禁用选择。 */
  disabled?: boolean;
  /** filter：是否作为列表过滤器使用，启用时提供 all 选项。 */
  filter?: boolean;
  /** refreshKey：元数据或 Book 成员变化的刷新代号，避免继续沿用已失效的归属。 */
  refreshKey?: number
}>()
/** model：受控 Book 选择值：all 为全部，none 为独立文档，其余为具体 Book ID。 */
const model = defineModel<string>({ required: true })
/** books：可供展示的 Book 列表或提交时的 Book 名称快照。 */
const books = shallowRef<KnowledgeBase[]>([])
/** cursor：下一页 Book 选项游标，不虚构尚未加载的选项。 */
const cursor = shallowRef<string>()
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** epoch：递增的本地请求代号，筛选、路由或生命周期改变后使旧响应失效。 */
let epoch = 0
onScopeDispose(() => { epoch++ })
// 分页读取选项；保留当前 ID 的可见退路，不因选项尚未载入把归属清空。
const options = computed(() => {
  const items = [{ value: 'none', label: '独立文档' }, ...books.value.map(b => ({ value: b.id, label: b.name }))]
  if (props.filter) items.unshift({ value: 'all', label: '全部文档' })
  if (model.value && !items.some(b => b.value === model.value)) items.push({ value: model.value, label: `Book ${model.value}` })
  return items
})
/**
 * load 分页加载当前知识库的 Book 选项，以请求代号丢弃旧结果。
 * @param reset 是否丢弃旧选项及游标，从第一页重新加载。
 */
async function load(reset = false) {
  const ticket = ++epoch
  busy.value = true; error.value = ''
  try {
    const page = await agentAdminApi.books(props.baseId, { limit: 50, cursor: reset ? undefined : cursor.value })
    if (ticket !== epoch) return
    books.value = reset ? page.items : [...books.value, ...page.items]; cursor.value = page.next_cursor
  } catch (reason) { if (ticket === epoch) error.value = knowledgeError(reason) }
  finally { if (ticket === epoch) busy.value = false }
}
watch(() => [props.baseId, props.refreshKey], () => { books.value = []; cursor.value = undefined; void load(true) }, { immediate: true })
</script>
<template>
  <div class="book-picker"><a-select v-model:value="model" :options="options" :loading="busy" :disabled="disabled" show-search option-filter-prop="label" aria-label="Book 归属" /><a-button v-if="cursor" :disabled="busy || disabled" size="small" @click="load()">更多 Book</a-button><a-button v-if="error" :disabled="disabled" size="small" @click="load(true)">重新加载 Book</a-button><span v-if="error" role="alert">{{ error }}</span></div>
</template>
<style scoped>.book-picker { display: grid; gap: 8px; min-width: 180px; }.book-picker :deep(.ant-select) { width: 100%; }</style>
