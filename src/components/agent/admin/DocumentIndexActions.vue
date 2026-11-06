<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { KnowledgeDocument } from '@/api/agentAdmin'
import { agentIndexAdminApi, type IndexMode } from '@/api/agentIndexAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'
import { useIndexCommand } from '@/composables/agent/useIndexCommand'
import IndexCommandFeedback from './IndexCommandFeedback.vue'
import ChunkPreview from './ChunkPreview.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** document：当前文档的最新元数据与索引摘要，单篇构建固定使用其独立索引修订。 */
  document: KnowledgeDocument;
  /** accepting：服务端与本地状态共同确认是否允许接纳新的索引命令。 */
  accepting: boolean
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** changed：操作结果发生变化，请父级重新核对列表与修订。 */
  changed: []
}>()
/** command：本组件独占的幂等写入状态，保留结果不确定时的原始请求。 */
const command = useIndexCommand()
/** preview：是否打开当前生效索引的只读片段预览。 */
const preview = shallowRef(false)
/** clearing：清除索引请求的独立写入状态。 */
const clearing = shallowRef(false)
/** clearError：清除索引失败提示，失败后仍通知父级重新核对事实。 */
const clearError = shallowRef('')
/** blocked：由写入中、待核对键和运行开关共同派生的交互门禁。 */
const blocked = computed(() => command.busy.value || clearing.value || !!command.requestKey.value)
/**
 * build 固定本次文档 ID、索引修订和构建意图，再通过幂等命令入口提交。
 * @param mode 原始 build/force 构建意图。
 */
async function build(mode: IndexMode) {
  const id = props.document.id, revision = props.document.index?.index_revision
  if (!revision || !props.accepting || blocked.value || props.document.index?.busy) return
  if (await command.run(key => agentIndexAdminApi.document(id, revision, mode, key))) emit('changed')
}
/** retry 显式重放已冻结的命令，复用原幂等键，成功后通知父级刷新。 */
async function retry() { if (await command.retry()) emit('changed') }
/** reviewed 管理员核对服务端结果后，清除本地待核对请求并允许后续操作。 */
function reviewed() { command.reviewed(); emit('changed') }
/** clear 在独立索引修订保护下清空 active，失败后通知父级重新核对。 */
async function clear() {
  const doc = props.document
  if (!doc.index || doc.index.busy || blocked.value) return
  clearing.value = true; clearError.value = ''
  try { await agentIndexAdminApi.clear(doc.id, doc.index.index_revision); emit('changed') }
  catch (reason) { clearError.value = knowledgeError(reason); emit('changed') }
  finally { clearing.value = false }
}
</script>
<template>
  <div class="index-actions">
    <a-space wrap><a-button :disabled="blocked || !accepting || !document.index || document.index.busy" @click="build('build')">建立索引</a-button><a-popconfirm title="强制重建本篇？完成前旧索引继续生效，失败保留旧索引。" ok-text="强制重建" cancel-text="取消" @confirm="build('force')"><a-button :disabled="blocked || !accepting || !document.index || document.index.busy">强制重建</a-button></a-popconfirm><a-button :disabled="!document.index?.active_version_id" @click="preview = true">片段预览</a-button><a-popconfirm title="清除生效索引？原文件和历史引用文本保留。" ok-text="清除索引" cancel-text="取消" @confirm="clear"><a-button danger :loading="clearing" :disabled="blocked || !document.index?.active_version_id || document.index.busy">清除索引</a-button></a-popconfirm></a-space>
    <a-alert v-if="clearError" type="error" show-icon :message="clearError" />
    <IndexCommandFeedback :busy="command.busy.value" :error="command.error.value" :request-key="command.requestKey.value" :job="command.job.value" @retry="retry" @reviewed="reviewed" />
    <ChunkPreview v-if="preview" :document-id="document.id" :title="document.title" @close="preview = false" />
  </div>
</template>
<style scoped>.index-actions { display: grid; gap: 8px; margin-top: 12px; }</style>
