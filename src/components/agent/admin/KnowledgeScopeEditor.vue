<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { agentAdminApi, type KnowledgeBase } from '@/api/agentAdmin'
import type { KnowledgeScope } from '@/api/agentToolAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'

const props = defineProps<{
  scope: KnowledgeScope // 已保存的权限快照。
  busy: boolean // 上层正在读取或提交修订。
  saving: boolean // 当前等待知识检索配置的保存结果。
}>()
const emit = defineEmits<{
  save: [scope: KnowledgeScope] // 提交完整范围，CAS 由工具管理页统一处理。
}>()

const mode = shallowRef<KnowledgeScope['mode']>('selected') // 当前未保存的范围模式。
const selected = shallowRef<string[]>([]) // 当前未保存的授权 ID。
const catalog = shallowRef<KnowledgeBase[]>([]) // 按需加载的现有知识库。
const cursor = shallowRef<string | undefined>() // 目录下一页游标。
const loading = shallowRef(false) // 当前目录读取状态。
const loaded = shallowRef(false) // 区分首次加载和已读完目录。
const error = shallowRef('') // 目录读取失败的公开提示。
const controller = new AbortController() // 页面卸载时取消目录读取。
onScopeDispose(() => controller.abort())

const draft = computed<KnowledgeScope>(() => ({
  mode: mode.value,
  knowledge_base_ids: mode.value === 'all' ? [] : [...selected.value].sort()
}))
/** 同一范围随开关刷新时保留未提交的编辑。 */
function scopeKey(scope: KnowledgeScope) {
  return JSON.stringify([scope.mode, ...[...scope.knowledge_base_ids].sort()])
}
const saved = computed(() => scopeKey(props.scope))
const dirty = computed(() => scopeKey(draft.value) !== saved.value)
const options = computed(() => {
  const values = catalog.value.map(base => ({
    value: base.id, label: base.name, disabled: selected.value.length >= 50 && !selected.value.includes(base.id)
  }))
  const known = new Set(values.map(option => option.value))
  for (const id of selected.value) {
    if (!known.has(id)) values.push({ value: id, label: id, disabled: false })
  }
  return values
})

/** 读取下一页。已选 ID 保留在多选项中，未加载名称时显示 ID。 */
async function loadPage() {
  if (loading.value || loaded.value && !cursor.value) return
  loading.value = true
  error.value = ''
  try {
    const page = await agentAdminApi.bases({ cursor: cursor.value, limit: 50 }, controller.signal)
    const next = new Map(catalog.value.map(item => [item.id, item]))
    for (const base of page.items) next.set(base.id, base)
    catalog.value = [...next.values()]
    cursor.value = page.next_cursor
    loaded.value = true
  } catch (cause) {
    if (!controller.signal.aborted) error.value = knowledgeError(cause)
  } finally {
    loading.value = false
  }
}

watch(saved, () => {
  mode.value = props.scope.mode
  selected.value = [...props.scope.knowledge_base_ids]
}, { immediate: true })
watch(mode, value => {
  if (value === 'selected' && !loaded.value) void loadPage()
}, { immediate: true })

/** 键盘提交同样遵守保存按钮的状态限制。 */
function save() {
  if (!props.busy && dirty.value && draft.value.knowledge_base_ids.length <= 50) emit('save', draft.value)
}
</script>

<template>
  <a-card title="知识库检索范围">
    <a-form :model="draft" layout="vertical" @finish="save">
      <a-form-item label="允许助手检索的知识库">
        <a-radio-group v-model:value="mode" :disabled="busy" aria-label="允许助手检索的知识库">
          <a-radio value="selected">指定知识库</a-radio>
          <a-radio value="all">全部知识库</a-radio>
        </a-radio-group>
      </a-form-item>
      <a-alert v-if="mode === 'all'" type="warning" show-icon
        message="保存后，聊天用户可通过助手获取现有及新增知识库中的命中片段与引用。" />
      <template v-else>
        <a-form-item label="已授权的知识库" html-for="assistant-knowledge-bases" :extra="`已选 ${selected.length} / 50，清空后关闭知识检索能力`">
          <a-select id="assistant-knowledge-bases" v-model:value="selected" mode="multiple" :options="options" :max-tag-count="4"
            option-filter-prop="label" :loading="loading" :disabled="busy" aria-label="已授权的知识库"
            placeholder="按名称选择一个或多个知识库" />
        </a-form-item>
        <a-alert v-if="error" type="error" show-icon :message="error" />
        <a-button v-if="cursor || error" :loading="loading" :disabled="busy" @click="loadPage">
          {{ error ? '重试加载' : '加载更多知识库' }}
        </a-button>
      </template>
      <div class="scope-actions">
        <a-button type="primary" html-type="submit" :disabled="busy || !dirty || selected.length > 50"
          :loading="saving">保存检索范围</a-button>
      </div>
    </a-form>
  </a-card>
</template>

<style scoped>
.scope-actions { margin-top: 16px; }
</style>
