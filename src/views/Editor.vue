<template>
  <div class="write-container">
    <div class="settings">
      <div class="editor-status">
        <strong>{{ isEditing ? '编辑文章' : '新建文章' }}</strong>
        <span v-if="loading">正在加载文章…</span>
        <span v-else-if="loadError" class="editor-error">{{ loadError }}</span>
        <span v-else-if="saveError" class="editor-error">{{ saveError }}</span>
        <span v-if="write.pending.value" role="status">{{ write.result.value?.contentSaved ? '正文已保存，合集仍需同步。' : '保存结果待确认，请继续处理上次操作。' }}</span>
        <button v-if="write.pending.value" type="button" :disabled="write.busy.value" @click="recoverSave">确认保存结果／继续同步</button>
        <button v-if="write.errorCode.value === 'MEMBERSHIP_CONFLICT'" type="button" :disabled="blocked" @click="reloadMembership">刷新所属合集，保留正文</button>
      </div>
      <a-form v-if="!loading && !loadError" ref="formRef" :model="form" :rules="rules">
        <div class="header-container">
          <div class="form-section">
            <a-form-item name="title">
              <a-input v-model:value="form.title" :disabled="blocked" placeholder="Title" style="width: 200px">
                <template #prefix><user-outlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item name="tag">
              <a-input v-model:value="form.tag" :disabled="blocked" placeholder="Tag" style="width: 150px">
                <template #prefix><user-outlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" :disabled="blocked" @click="addTag">添加标签</a-button>
                <a-button type="primary" :loading="saving || write.busy.value" :disabled="blocked || collectionBusy" @click="handleSubmit">{{ isEditing ? '保存修改' : '发布新文章' }}</a-button>
              </a-space>
            </a-form-item>
          </div>
          <div class="tag-section">
            <a-tag
              v-for="(item, index) in tags"
              :key="index"
              :closable="!blocked"
              color="green"
              @close="deleteTip(item)"
            >
              {{ item }}
            </a-tag>
          </div>
        </div>
        <ArticleCollectionSelector v-model="collectionId" :disabled="blocked" @busy="collectionBusy = $event" />
      </a-form>
    </div>
    <mavon-editor
      v-if="!loading && !loadError"
      :key="editorId || 'create'"
      ref="md"
      v-model="markdown.value"
      :editable="!blocked"
      class="editor"
      @imgAdd="imgAdd"
      @save="onSave"
      @change="onSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onUnmounted, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useArticleStore } from '@/stores/article'
import { IMG } from '@/config/url'
import { message } from '@/utils/talk'
import { UserOutlined } from '@ant-design/icons-vue'
import { mavonEditor } from 'mavon-editor'
import 'mavon-editor/dist/css/index.css'
import type { FormInstance } from 'ant-design-vue'
import type { MavonEditorInstance } from 'mavon-editor'
import type { ArticleSaveTarget, ArticleSaveInput, ArticleWriteResult } from '@/types/article'
import ArticleCollectionSelector from '@/components/article/ArticleCollectionSelector.vue'
import { useArticleOperation } from '@/composables/useArticleOperation'
import { ARTICLE_SAVE } from '@/config/url'

const route = useRoute()
const router = useRouter()
const articleStore = useArticleStore()
const write = useArticleOperation('editor')
const collectionId = shallowRef<string | null>(null)
const expectedCollectionId = shallowRef<string | null>(null)
const collectionBusy = shallowRef(false)

const formRef = ref<FormInstance>()
const md = ref<MavonEditorInstance | null>(null)

const markdown = reactive<{ value: string; html: string }>({
  value: '',
  html: ''
})

const tags = ref<string[]>([])
const form = reactive<{ title: string; tag: string }>({
  title: '',
  tag: ''
})

const rules = {
  title: [{ required: true, message: '标题不能为空', trigger: 'blur' }]
}

const upload_image = computed(() => articleStore.upload_image)
const editorId = computed(() => {
  const raw = route.params.id
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})
const isEditing = computed(() => editorId.value !== '')
const loading = shallowRef(false)
const loadError = shallowRef('')
const saving = shallowRef(false)
const saveError = shallowRef('')
const blocked = computed(() => saving.value || write.busy.value || write.pending.value)
let editorEpoch = 0

// 离开编辑页后，进行中的保存可以完成，但旧响应不能再弹成功提示或改写导航。
onUnmounted(() => { editorEpoch++ })

watch(upload_image, (val: string) => {
  if (val) {
    const pos = articleStore.pos
    md.value?.$img2Url(pos, `${IMG}/article/upload/` + val)
  }
})

/** 每次切换路由先清空表单；旧请求即使迟到，也不能覆盖当前文章。 */
watch(editorId, async (id, _previous, onCleanup) => {
  const epoch = ++editorEpoch
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  markdown.value = ''
  markdown.html = ''
  form.title = ''
  form.tag = ''
  tags.value = []
  collectionId.value = null
  expectedCollectionId.value = null
  loadError.value = ''
  saveError.value = ''
  saving.value = false
  formRef.value?.clearValidate()
  if (!id) {
    loading.value = false
    const raw = route.query.collectionId
    collectionId.value = (Array.isArray(raw) ? raw[0] : raw) || null
    restorePending('')
    return
  }

  loading.value = true
  try {
    const detail = await articleStore.getReviseArticleDetails({ id }, controller.signal)
    if (controller.signal.aborted || epoch !== editorEpoch) return
    markdown.value = detail.markdown
    form.title = detail.title
    tags.value = [...detail.tags]
    collectionId.value = detail.collectionId ?? null
    expectedCollectionId.value = detail.collectionId ?? null
    restorePending(id)
  } catch (error) {
    if (controller.signal.aborted || epoch !== editorEpoch) return
    loadError.value = error instanceof Error ? error.message : '文章加载失败，请返回目录重试'
  } finally {
    if (epoch === editorEpoch) loading.value = false
  }
}, { immediate: true })

function restorePending(id: string) {
  const snapshot = write.snapshot.value
  if (!snapshot || snapshot.id !== id) return
  form.title = String(snapshot.title || '')
  markdown.value = String(snapshot.markdown || '')
  markdown.html = String(snapshot.html || '')
  tags.value = Array.isArray(snapshot.tags) ? snapshot.tags.filter((tag): tag is string => typeof tag === 'string') : []
  collectionId.value = typeof snapshot.collectionId === 'string' ? snapshot.collectionId : null
  expectedCollectionId.value = typeof snapshot.expectedCollectionId === 'string' ? snapshot.expectedCollectionId : null
}

async function finishSave(result: ArticleWriteResult, fallback: string | null) {
  message('保存文章成功！', 2)
  const target = result.collectionId !== undefined ? result.collectionId : fallback
  await router.push(target ? '/article/collection/' + target : '/article')
}

async function recoverSave() {
  const epoch = editorEpoch
  const snapshot = write.snapshot.value
  const target = typeof snapshot?.collectionId === 'string' ? snapshot.collectionId : null
  try { const result = await write.recover(); if (epoch === editorEpoch) await finishSave(result, target) }
  catch (cause) { if (epoch === editorEpoch) saveError.value = cause instanceof Error ? cause.message : '保存结果待确认' }
}

async function reloadMembership() {
  const id = editorId.value
  const epoch = editorEpoch
  if (!id || blocked.value) return
  try {
    const detail = await articleStore.getReviseArticleDetails({ id })
    if (epoch !== editorEpoch) return
    expectedCollectionId.value = detail.collectionId ?? null
    collectionId.value = detail.collectionId ?? null
    saveError.value = ''
    write.clearError()
  } catch (cause) { if (epoch === editorEpoch) saveError.value = cause instanceof Error ? cause.message : '归属加载失败' }
}

/** 同时提交 Markdown 源文和编辑器渲染的 HTML 快照。 */
const handleSubmit = async (): Promise<void> => {
  if (blocked.value || collectionBusy.value || loading.value || loadError.value || !formRef.value) return
  const epoch = editorEpoch
  const target: ArticleSaveTarget = editorId.value ? { mode: 'edit', id: editorId.value } : { mode: 'create' }
  // 在点击时固定保存目标和内容；验证与网络请求期间即使切页，也不会改写另一篇文章。
  const selectedCollection = collectionId.value
  const input: ArticleSaveInput = { title: form.title, tags: [...tags.value], markdown: markdown.value, html: markdown.html, collectionId: selectedCollection }
  if (target.mode === 'edit') input.expectedCollectionId = expectedCollectionId.value
  saving.value = true
  saveError.value = ''
  try {
    await formRef.value.validate()
    if (epoch !== editorEpoch) return
    const result = await write.execute('POST', ARTICLE_SAVE, { ...input, id: target.mode === 'edit' ? target.id : '' }, snapshot => {
      const savedInput = { ...snapshot }
      delete savedInput.id
      return articleStore.articleSave(savedInput as unknown as ArticleSaveInput, target)
    })
    if (epoch !== editorEpoch) return
    await finishSave(result, selectedCollection)
  } catch (error) {
    if (epoch === editorEpoch && error instanceof Error) saveError.value = error.message
  } finally {
    if (epoch === editorEpoch) saving.value = false
  }
}

const addTag = (): void => {
  if (form.tag) {
    tags.value.push(form.tag)
    form.tag = ''
  }
}

const deleteTip = (tag: string): void => {
  if (blocked.value) return
  const index = tags.value.indexOf(tag)
  if (index !== -1) {
    tags.value.splice(index, 1)
  }
}

const onSave = (_value: string, render: string): void => {
  markdown.html = render
}

const imgAdd = (pos: string | number, file: File): void => {
  const formdata = new FormData()
  formdata.append('image', file)
  articleStore.articleImageUpload({ formdata, pos })
}
</script>

<style lang="less" scoped>
.write-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.settings {
  background: linear-gradient(to right, #fff176, #a5d6a7);
  min-height: 80px;
  padding: 10px 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.editor-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 auto 8px;
  max-width: 1400px;
}

.editor-error { color: #9f3030; }

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.form-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.tag-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  align-items: center;
  padding-top: 5px;
}

.editor {
  flex: 1;
  overflow: hidden;
  z-index: 100;
}

:deep(.ant-form-item) {
  margin-bottom: 0;
  margin-right: 0;
}
</style>

