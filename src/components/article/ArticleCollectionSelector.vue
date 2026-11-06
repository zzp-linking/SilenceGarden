<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { collectionsApi, collectionAdminBase } from '@/api/articleCollections'
import { useArticleOperation } from '@/composables/useArticleOperation'
import type { ArticleCollection, ArticleWriteResult } from '@/types/article'
import CollectionMetadataForm from './CollectionMetadataForm.vue'
const props = defineProps<{ disabled?: boolean }>()
const model = defineModel<string | null>({ default: null })
const emit = defineEmits<{ busy: [value: boolean] }>()
const books = ref<ArticleCollection[]>([])
const loading = shallowRef(false)
const loadError = shallowRef('')
const write = useArticleOperation('editor-create-collection')
const creating = shallowRef(write.pending.value)
const locked = computed(() => props.disabled || write.busy.value || write.pending.value)
const unknownSelection = computed(() => model.value && !books.value.some(book => book._id === model.value))
watch(() => loading.value || write.busy.value || write.pending.value, value => emit('busy', value), { immediate: true })
async function load() {
  loading.value = true; loadError.value = ''
  try { books.value = await collectionsApi.list() }
  catch (cause) { loadError.value = cause instanceof Error ? cause.message : '合集列表加载失败' }
  finally { loading.value = false }
}
async function finish(result: ArticleWriteResult) {
  await load()
  if (result.id) model.value = result.id
  creating.value = false
}
async function create(value: { title: string; description: string }) {
  try { await finish(await write.execute('POST', collectionAdminBase, value)) } catch { /* 写入返回可恢复错误。 */ }
}
async function recover() { try { await finish(await write.recover()) } catch { /* 保持对话框及原命令。 */ } }
function change(event: Event) { model.value = (event.target as HTMLSelectElement).value || null }
onMounted(load)
</script>
<template>
  <div class="collection-selector">
    <label>所属合集
      <select :value="model || ''" :disabled="disabled || loading" @change="change">
        <option value="">独立文章</option>
        <option v-if="unknownSelection" :value="model || ''">当前所属合集（暂未载入）</option>
        <option v-for="book in books" :key="book._id" :value="book._id">{{ book.title }}</option>
      </select>
    </label>
    <button type="button" :disabled="disabled || loading" @click="creating = true">新建合集</button>
    <RouterLink to="/admin/article-collections">管理合集</RouterLink>
    <span v-if="loadError" class="error" role="status">{{ loadError }} <button type="button" @click="load">重试</button></span>
    <a-modal v-model:open="creating" title="新建合集" :footer="null" :closable="!locked" :mask-closable="!locked" :keyboard="!locked">
      <CollectionMetadataForm :title="String(write.snapshot.value?.title || '')" :description="String(write.snapshot.value?.description || '')"
        :disabled="locked" submit-label="创建并选中" @submit="create" />
      <p v-if="write.error.value" class="error" role="alert">{{ write.error.value }}</p>
      <button v-if="write.pending.value" type="button" :disabled="write.busy.value" @click="recover">确认创建结果／继续同步</button>
    </a-modal>
  </div>
</template>
<style scoped>
.collection-selector { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding-top:8px; font-size:14px; }
.collection-selector label { display:flex; align-items:center; gap:8px; }
.collection-selector select { min-height:44px; max-width:240px; border:1px solid #aabfaf; border-radius:4px; padding:8px; background:#fff; color:#304238; }
.collection-selector button { min-height:44px; padding:8px 12px; border:1px solid #aabfaf; background:#fff; border-radius:4px; cursor:pointer; }
.collection-selector a { color:#315746; }
.error { color:#9f3030; line-height:1.8; }
.collection-selector :focus-visible { outline:2px solid #a94737; outline-offset:2px; }
</style>

