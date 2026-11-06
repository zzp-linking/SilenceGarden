<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import { Upload, type UploadFile, type UploadProps } from 'ant-design-vue'
import { InboxOutlined } from '@ant-design/icons-vue'
import { V2HttpError } from '@/api/clientV2'
import { agentAdminApi, type KnowledgeDocument } from '@/api/agentAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'
import { useKnowledgeUploadStore } from '@/stores/knowledgeUpload'
import BookPicker from './BookPicker.vue'
/** props：父组件传入的只读数据与操作门禁，表单不直接修改这些值。 */
const props = defineProps<{
  /** baseId：当前所属知识库 ID，限制所有读取与可选 Book 的范围。 */
  baseId: string;
  /** existing：编辑依据的完整旧快照；null 表示新建，更新必须携带其元数据修订。 */
  existing: KnowledgeDocument | null
}>()
/** emit：只向父级报告完成或关闭事件，由父级决定列表与运行状态刷新。 */
const emit = defineEmits<{
  /** saved：保存确认成功，通知父级更新快照或重新读取列表。 */
  saved: [];
  /** cancel：关闭表单，不提交草稿。 */
  cancel: []
}>()
/** uploadDefaults：按知识库隔离的本标签页上传偏好，只有确认成功后才写入。 */
const uploadDefaults = useKnowledgeUploadStore()
/** initial：创建表单时固定的元数据或上次成功上传偏好。 */
const initial = props.existing ?? uploadDefaults.defaultsFor(props.baseId)
/** draft：当前可编辑草稿，与读取到的服务端快照分离。 */
const draft = reactive({ title: props.existing?.title ?? '', tags: [...initial.tags], book: initial.book_id ?? 'none' })
/** UploadDragger：上传选择组件别名，仅负责文件选择与展示。 */
const UploadDragger = Upload.Dragger
/** files：当前选择的单个文件列表，尚未提交时仅保存在本表单内。 */
const files = shallowRef<UploadFile[]>([])
/** file：当前唯一选中文件的浏览器原始对象。 */
const file = computed(() => files.value[0]?.originFileObj)
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** needsRefresh：冲突或写入结果不确定后要求先关闭核对，避免再次提交产生重复资源。 */
const needsRefresh = shallowRef(false)
// Dragger 只负责选择/展示文件；返回 false 禁止组件自行发请求，仍由
// 原有 API 按 metadata → file 的 multipart 合同手动提交一次。
const beforeUpload: UploadProps['beforeUpload'] = candidate => {
  if (busy.value || needsRefresh.value) return Upload.LIST_IGNORE
  if (!/\.(txt|md|pdf|docx)$/i.test(candidate.name)) { error.value = '仅支持 TXT、MD、PDF、DOCX 原文件'; return Upload.LIST_IGNORE }
  if (!candidate.size) { error.value = '文件内容为空，请重新选择'; return Upload.LIST_IGNORE }
  error.value = ''
  return false
}
/** choose：保留一个选中文件；仅在标题仍是自动建议时随文件名更新标题。 */
const choose: UploadProps['onChange'] = info => {
  if (busy.value || needsRefresh.value) return
  const previousTitle = files.value[0]?.name.replace(/\.[^.]+$/, '')
  const suggestTitle = !draft.title || draft.title === previousTitle
  files.value = info.fileList.slice(-1)
  // 换文件时更新自动标题，保留用户已手动填写的标题；移除也同步清理文件状态。
  if (suggestTitle) draft.title = files.value[0]?.name.replace(/\.[^.]+$/, '') ?? ''
}
/** save 校验元数据后更新旧文档或上传新文档，仅在确认上传成功后记住偏好。 */
async function save() {
  if (busy.value || needsRefresh.value) return
  error.value = ''
  if (!props.existing && !file.value) { error.value = '请选择原文件'; return }
  const tags = [...new Set(draft.tags.map(t => t.trim().toLowerCase()).filter(Boolean))]
  if (tags.length > 20 || tags.some(t => [...t].length > 40)) { error.value = '最多 20 个标签，每个不超过 40 字'; return }
  busy.value = true
  const baseId = props.baseId
  try {
    const input = { title: draft.title, tags, book_id: draft.book === 'none' ? null : draft.book }
    if (props.existing) await agentAdminApi.saveDocument(props.existing, input)
    else {
      await agentAdminApi.upload(baseId, input, file.value!)
      uploadDefaults.remember(baseId, input)
    }
    emit('saved')
  } catch (reason) {
    error.value = knowledgeError(reason)
    // 冲突或网络结果不确定时先回到列表核对，禁止直接再次上传造成重复文档。
    needsRefresh.value = !(reason instanceof V2HttpError) || reason.status >= 500 || reason.status === 409
  } finally { busy.value = false }
}
</script>
<template>
  <a-modal open :title="existing ? '维护文档元数据' : '上传文档'" :footer="null" :closable="!busy" :mask-closable="!busy" @cancel="emit('cancel')">
    <a-alert v-if="error" role="alert" type="error" show-icon :message="error" class="form-alert" />
    <a-alert v-if="existing" type="info" show-icon message="原文件固定不变；修改正文需删除旧文档，再重新上传。" class="form-alert" />
    <a-form layout="vertical" :model="draft" @finish="save">
      <a-form-item v-if="!existing" label="原文件" required help="大小由服务端配置限制，默认 20 MiB。选择文件后，点击“上传并保存”提交。">
        <UploadDragger :file-list="files" accept=".txt,.md,.pdf,.docx" :multiple="false" :max-count="1" :before-upload="beforeUpload" :disabled="busy || needsRefresh" :show-upload-list="{ showRemoveIcon: !busy && !needsRefresh }" @change="choose">
          <p class="ant-upload-drag-icon"><InboxOutlined /></p>
          <p class="ant-upload-text">点击或拖拽原文件到此处</p>
          <p class="ant-upload-hint">每次上传一个文件，支持 UTF-8 TXT / MD、PDF、DOCX</p>
        </UploadDragger>
      </a-form-item>
      <a-form-item label="标题" name="title" :rules="[{ required: true, whitespace: true, max: 200, message: '请输入 1～200 字标题' }]"><a-input v-model:value="draft.title" :maxlength="200" :disabled="busy || needsRefresh" /></a-form-item>
      <a-form-item label="手动标签" help="回车添加，最多 20 个，每个 40 字；忽略大小写并去重。"><a-select v-model:value="draft.tags" mode="tags" :token-separators="[',', '，']" :disabled="busy || needsRefresh" aria-label="手动标签" /></a-form-item>
      <a-form-item label="Book 归属" :help="existing?.index?.busy ? '索引排队或执行期间暂不可调整归属；标题和标签仍可维护。' : ''"><BookPicker v-model="draft.book" :base-id="baseId" :disabled="busy || needsRefresh || existing?.index?.busy" /></a-form-item>
      <p v-if="!existing" class="upload-defaults-hint">上传成功后，下次会沿用本知识库的标签和 Book 归属。</p>
      <div v-if="existing" class="source-detail"><p>来源：{{ existing.source.original_name }} · {{ existing.source.byte_size }} 字节</p><p>文档 ID：{{ existing.id }}</p><p>固定资产 ID：{{ existing.source.id }}</p><p>SHA-256：{{ existing.source.sha256 }}</p><p>元数据修订：{{ existing.revision }}</p></div>
      <a-space wrap><a-button type="primary" html-type="submit" :loading="busy" :disabled="needsRefresh">{{ existing ? '保存元数据' : '上传并保存' }}</a-button><a-button :disabled="busy" @click="emit('cancel')">{{ needsRefresh ? '关闭并刷新核对' : '取消' }}</a-button></a-space>
    </a-form>
  </a-modal>
</template>
<style scoped>.form-alert { margin-bottom: 16px; }.source-detail { overflow-wrap: anywhere; margin-bottom: 16px; font-size: 13px; }.upload-defaults-hint { margin: 0 0 16px; color: var(--ant-color-text-secondary, #8c8c8c); font-size: 13px; }</style>
