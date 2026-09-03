<template>
  <div class="write-container">
    <div class="settings">
      <a-form ref="formRef" :model="form" :rules="rules">
        <div class="header-container">
          <div class="form-section">
            <a-form-item name="title">
              <a-input v-model:value="form.title" placeholder="Title" style="width: 200px">
                <template #prefix><user-outlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item name="tag">
              <a-input v-model:value="form.tag" placeholder="Tag" style="width: 150px">
                <template #prefix><user-outlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="addTag">添加标签</a-button>
                <a-button type="primary" @click="handleSubmit">发布</a-button>
              </a-space>
            </a-form-item>
          </div>
          <div class="tag-section">
            <a-tag
              v-for="(item, index) in tags"
              :key="index"
              closable
              color="green"
              @close="deleteTip(item)"
            >
              {{ item }}
            </a-tag>
          </div>
        </div>
      </a-form>
    </div>
    <mavon-editor
      ref="md"
      v-model="markdown.value"
      class="editor"
      @imgAdd="imgAdd"
      @save="onSave"
      @change="onSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useArticleStore } from '@/store/article'
import { IMG } from '@/config/url'
import { UserOutlined } from '@ant-design/icons-vue'
import { mavonEditor } from 'mavon-editor'
import 'mavon-editor/dist/css/index.css'
import type { FormInstance } from 'ant-design-vue'
import type { MavonEditorInstance } from 'mavon-editor'
import type { ArticleEditDetail } from '@/types/article'

const route = useRoute()
const articleStore = useArticleStore()

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
const revise_article = computed(() => articleStore.revise_article)

watch(upload_image, (val: string) => {
  if (val) {
    const pos = articleStore.pos
    md.value?.$img2Url(pos, `${IMG}/article/upload/` + val)
  }
})

watch(revise_article, (val: ArticleEditDetail) => {
  if (val && Object.keys(val).length > 0) {
    markdown.value = val.markdown || ''
    form.title = val.title || ''
    tags.value = val.tags || []
  }
}, { immediate: true })

onMounted(() => {
  const idParam = route.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  if (id) {
    articleStore.getReviseArticleDetails({ id })
  }
})

const handleSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate()
    await articleStore.articleSave({
        title: form.title,
        tags: tags.value,
        markdown: markdown.value,
        html: markdown.html
      })
  } catch (error) {
    console.log('error', error)
  }
}

const addTag = (): void => {
  if (form.tag) {
    tags.value.push(form.tag)
    form.tag = ''
  }
}

const deleteTip = (tag: string): void => {
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
  min-width: 600px;
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

