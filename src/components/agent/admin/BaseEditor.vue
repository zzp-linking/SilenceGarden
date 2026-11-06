<script setup lang="ts">
import { reactive, shallowRef } from 'vue'
import { V2HttpError } from '@/api/clientV2'
import { agentAdminApi, type KnowledgeBase } from '@/api/agentAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** parent：父知识库 ID；null 表示创建或维护知识库本身。 */
  parent: string | null;
  /** existing：编辑依据的完整旧快照；null 表示新建，更新必须携带其元数据修订。 */
  existing: KnowledgeBase | null
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** saved：保存确认成功，通知父级更新快照或重新读取列表。 */
  saved: [value: KnowledgeBase];
  /** cancel：关闭表单，不提交草稿。 */
  cancel: []
}>()
// 草稿与修订快照同生共灭；冲突时保留草稿，由用户关闭后重新打开最新记录。
const draft = reactive({ name: props.existing?.name ?? '', description: props.existing?.description ?? '' })
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** needsRefresh：冲突或写入结果不确定后要求先关闭核对，避免再次提交产生重复资源。 */
const needsRefresh = shallowRef(false)
/** save 保存完整名称说明快照，冲突或不确定结果要求先关闭核对。 */
async function save() {
  if (busy.value || needsRefresh.value) return
  busy.value = true; error.value = ''
  try { emit('saved', await agentAdminApi.saveBase(props.parent, props.existing, draft)) }
  catch (reason) {
    error.value = knowledgeError(reason)
    needsRefresh.value = !(reason instanceof V2HttpError) || reason.status >= 500 || reason.status === 409
  }
  finally { busy.value = false }
}
</script>
<template>
  <a-modal open :title="`${existing ? '编辑' : '创建'}${parent ? 'Book' : '知识库'}`" :footer="null" :closable="!busy" :mask-closable="!busy" @cancel="emit('cancel')">
    <a-alert v-if="error" role="alert" type="error" show-icon :message="error" class="form-error" />
    <a-form layout="vertical" :model="draft" @finish="save">
      <a-form-item label="名称" name="name" :rules="[{ required: true, whitespace: true, max: 200, message: '请输入 1～200 字名称' }]"><a-input v-model:value="draft.name" :maxlength="200" :disabled="busy" /></a-form-item>
      <a-form-item label="说明" name="description"><a-textarea v-model:value="draft.description" :maxlength="2000" :rows="4" show-count :disabled="busy" /></a-form-item>
      <a-space><a-button type="primary" html-type="submit" :loading="busy" :disabled="needsRefresh">{{ existing ? '保存信息' : '创建' }}</a-button><a-button :disabled="busy" @click="emit('cancel')">{{ needsRefresh ? '关闭并刷新核对' : '取消' }}</a-button></a-space>
    </a-form>
  </a-modal>
</template>
<style scoped>.form-error { margin-bottom: 16px; }</style>
