<script setup lang="ts">
import { onScopeDispose, reactive, shallowRef, watch } from 'vue'
import { agentIndexAdminApi, type SearchInput, type SearchResult } from '@/api/agentIndexAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'
import BookPicker from './BookPicker.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** baseId：当前所属知识库 ID，限制所有读取与可选 Book 的范围。 */
  baseId: string;
  /** ready：当前是否允许执行检索验证。 */
  ready: boolean;
  /** refreshKey：元数据或 Book 成员变化的刷新代号，避免继续沿用已失效的归属。 */
  refreshKey: number
}>()
/** draft：当前可编辑草稿，与读取到的服务端快照分离。 */
const draft = reactive<SearchInput>({ query: '', book: 'all', title: '', tag: '', top_k: 8 })
/** applied：本次已提交的筛选快照，与仍可修改的表单输入分开。 */
const applied = shallowRef<SearchInput | null>(null)
/** result：最近一次检索验证结果，保留原始命中与真实来源定位。 */
const result = shallowRef<SearchResult | null>(null)
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** epoch：递增的本地请求代号，筛选、路由或生命周期改变后使旧响应失效。 */
let epoch = 0
/** controller：当前读取的取消控制器，新请求或卸载时中止旧读取。 */
let controller: AbortController | undefined
watch(() => props.baseId, () => { epoch++; controller?.abort(); result.value = null; applied.value = null; error.value = ''; busy.value = false; draft.book = 'all' })
onScopeDispose(() => { epoch++; controller?.abort() })
/** search 固定本次问题和过滤快照，校验长度后检索，以请求代号阻止旧结果回写。 */
async function search() {
  if (!props.ready || busy.value) return
  if (!draft.query.trim() || [...draft.query.trim()].length > 1000) { error.value = '请输入 1～1000 字查询；完整分词超限时还需缩短。'; return }
  const ticket = ++epoch, id = props.baseId, input = { ...draft }
  controller?.abort(); controller = new AbortController()
  busy.value = true; error.value = ''; result.value = null; applied.value = input
  try { const value = await agentIndexAdminApi.search(id, input, controller.signal); if (ticket === epoch) result.value = value }
  catch (reason) { if (ticket === epoch) error.value = knowledgeError(reason) }
  finally { if (ticket === epoch) busy.value = false }
}
</script>
<template>
  <a-card title="检索验证" :bordered="false"><p>在当前知识库内检索生效片段。距离越小越相近，距离不代表回答正确概率。</p><a-alert v-if="!ready" type="info" show-icon message="检索服务当前不可用；文档管理和历史任务仍可使用。" /><a-form :model="draft" layout="vertical" @finish="search"><a-form-item label="查询" required><a-textarea v-model:value="draft.query" :rows="3" :maxlength="2000" aria-label="检索查询" placeholder="例如：ref 和 computed 有什么区别？" /></a-form-item><div class="search-filters"><a-form-item label="Book 范围"><BookPicker v-model="draft.book" :base-id="baseId" filter :refresh-key="refreshKey" /></a-form-item><a-form-item label="标题包含"><a-input v-model:value="draft.title" :maxlength="200" aria-label="检索标题包含" /></a-form-item><a-form-item label="标签精确匹配"><a-input v-model:value="draft.tag" :maxlength="40" aria-label="检索标签" /></a-form-item><a-form-item label="返回片段数"><a-input-number v-model:value="draft.top_k" :min="1" :max="20" :precision="0" aria-label="返回片段数" /></a-form-item></div><a-button type="primary" html-type="submit" :loading="busy" :disabled="!ready">检索验证</a-button></a-form><a-alert v-if="error" type="error" show-icon :message="error" class="result-message" /><p v-if="applied" class="result-message">本次查询：{{ applied.query }} · 标题 {{ applied.title || '不限' }} · 标签 {{ applied.tag || '不限' }}</p><a-alert v-if="result?.status === 'no_matches'" type="info" show-icon message="没有符合当前范围与过滤条件的生效片段。" /><article v-for="hit in result?.hits ?? []" :key="hit.chunk_id" class="search-hit"><a-space wrap><strong>{{ hit.title }}</strong><a-tag>{{ hit.book_name || '独立文档' }}</a-tag><a-tag>距离 {{ hit.distance.toFixed(4) }}</a-tag><span>片段 {{ hit.ordinal + 1 }} · {{ hit.tokens }} tokens</span></a-space><p>{{ hit.original_name }} · {{ hit.heading.join(' / ') || '正文' }}</p><p v-for="(span, i) in hit.source_spans" :key="i" class="admin-muted">{{ span.page ? `第 ${span.page} 页 · ` : '' }}{{ span.line_start ? `行 ${span.line_start}–${span.line_end} · ` : '' }}{{ span.paragraph ? `段落 ${span.paragraph} · ` : '' }}{{ span.table ? `表 ${span.table} 行 ${span.row} · ` : '' }}字节 {{ span.start }}–{{ span.end }}</p><pre class="hit-text">{{ hit.text }}</pre><details><summary>来源标识</summary><p class="admin-mono">文档 {{ hit.document_id }} · 资产 {{ hit.source_asset_id }} · 索引版本 {{ hit.index_version_id }} · 片段 {{ hit.chunk_id }}</p></details></article></a-card>
</template>
<style scoped>.search-filters { display: grid; grid-template-columns: minmax(180px, 1fr) 1fr 1fr 120px; gap: 16px; }.result-message { margin-top: 16px; }.search-hit { border-top: 1px solid #f0f0f0; margin-top: 20px; padding-top: 20px; }.hit-text { white-space: pre-wrap; overflow-wrap: anywhere; background: #fafafa; padding: 16px; max-height: 480px; overflow: auto; }@media (max-width: 850px) { .search-filters { grid-template-columns: 1fr 1fr; } }@media (max-width: 540px) { .search-filters { grid-template-columns: 1fr; gap: 0; } }</style>
