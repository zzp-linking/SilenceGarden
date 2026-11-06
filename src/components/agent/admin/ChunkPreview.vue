<script setup lang="ts">
import { agentIndexAdminApi } from '@/api/agentIndexAdmin'
import { useKnowledgePage } from '@/composables/agent/useKnowledgePage'
import { watch } from 'vue'
import KnowledgePager from './KnowledgePager.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** documentId：需要预览当前 active 片段的文档 ID。 */
  documentId: string;
  /** title：当前文档标题；修改标题不会替换固定原文件。 */
  title: string
}>()
defineEmits<{
  /** close：关闭只读预览。 */
  close: []
}>()
/** page：当前面板独占的游标读取状态，筛选变化后从首页重新加载。 */
const page = useKnowledgePage((cursor, signal) => agentIndexAdminApi.chunks(props.documentId, { cursor, limit: 5 }, signal))
watch(() => props.documentId, () => void page.first(), { immediate: true })
</script>
<template>
  <a-modal open :title="`${title} · 生效片段`" :footer="null" :width="880" @cancel="$emit('close')">
    <p>仅预览当前生效索引的原文；片段不可编辑。位置偏移按规范化文本 UTF-8 字节计算。</p>
    <a-alert v-if="page.error.value" type="error" show-icon :message="page.error.value" />
    <a-spin :spinning="page.loading.value"><a-empty v-if="!page.loading.value && !page.data.value.items.length && !page.error.value" description="没有生效片段，请先建立索引" /><article v-for="chunk in page.data.value.items" :key="chunk.id" class="chunk"><strong>片段 {{ chunk.ordinal + 1 }} · {{ chunk.tokens }} tokens</strong><p>{{ chunk.heading.join(' / ') || '正文' }}</p><p v-for="(span, i) in chunk.source_spans" :key="i" class="admin-muted">{{ span.page ? `第 ${span.page} 页 · ` : '' }}{{ span.line_start ? `行 ${span.line_start}–${span.line_end} · ` : '' }}{{ span.paragraph ? `段落 ${span.paragraph} · ` : '' }}{{ span.table ? `表 ${span.table} 行 ${span.row} · ` : '' }}字节 {{ span.start }}–{{ span.end }}</p><pre class="chunk-text">{{ chunk.text }}</pre></article></a-spin>
    <KnowledgePager :previous="page.canPrevious.value" :next="!!page.data.value.next_cursor" :busy="page.loading.value" :page="page.index.value" @previous="page.previous" @next="page.next" /><a-button @click="page.first">重新读取生效版本</a-button>
  </a-modal>
</template>
<style scoped>.chunk { border-top: 1px solid #f0f0f0; padding: 16px 0; }.chunk-text { white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; background: #fafafa; padding: 12px; max-height: 400px; overflow: auto; }</style>
