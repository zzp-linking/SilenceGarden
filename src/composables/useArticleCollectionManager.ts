import { computed, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { articleAdminBase, collectionAdminBase, collectionsApi } from '@/api/articleCollections'
import { useArticleOperation } from './useArticleOperation'
import type { ArticleCatalogItem, ArticleCollection, ArticleWriteResult } from '@/types/article'

/** 管理操作编排；表单与排序行分别维护自身展示契约。 */
export function useArticleCollectionManager() {
  const route = useRoute()
  const books = ref<ArticleCollection[]>([])
  const book = ref<ArticleCollection | null>(null)
  const entries = ref<ArticleCatalogItem[]>([])
  const selectedId = shallowRef(typeof route.query.id === 'string' ? route.query.id : '')
  const loading = shallowRef(false)
  const loadError = shallowRef('')
  const write = useArticleOperation('collection-manager')
  const locked = computed(() => loading.value || write.busy.value || write.pending.value)
  const available = computed(() => entries.value.filter(item => !item.collectionId))
  let detailEpoch = 0
  let listEpoch = 0
  onBeforeUnmount(() => { detailEpoch++; listEpoch++ })
  async function select(id: string) {
    const ticket = ++detailEpoch
    selectedId.value = id; book.value = null; loadError.value = ''
    if (!id) return
    loading.value = true
    try { const value = await collectionsApi.detail(id, true); if (ticket === detailEpoch) book.value = value }
    catch (cause) { if (ticket === detailEpoch) loadError.value = cause instanceof Error ? cause.message : '合集加载失败' }
    finally { if (ticket === detailEpoch) loading.value = false }
  }
  async function refresh(preferred?: string) {
    const ticket = ++listEpoch
    loading.value = true; loadError.value = ''
    try {
      const [list, articles] = await Promise.all([collectionsApi.list(), collectionsApi.entries()])
      if (ticket !== listEpoch) return
      books.value = list; entries.value = articles
      const target = preferred !== undefined ? preferred : selectedId.value
      const id = list.some(value => value._id === target) ? target : (list[0]?._id || '')
      await select(id)
    } catch (cause) { if (ticket === listEpoch) loadError.value = cause instanceof Error ? cause.message : '管理数据加载失败' }
    finally { if (ticket === listEpoch) loading.value = false }
  }
  async function perform(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload: Record<string, unknown>) {
    try {
      const result = await write.execute(method, url, payload)
      await finish(result)
    } catch { /* 操作保留其错误及所有可恢复命令。 */ }
  }
  async function finish(result: ArticleWriteResult) { await refresh(result.id || selectedId.value) }
  async function recover() { try { await finish(await write.recover()) } catch { /* 保留待处理命令。 */ } }
  async function saveMetadata(value: { title: string; description: string }) {
    if (!selectedId.value) await perform('POST', collectionAdminBase, value)
    else if (book.value) await perform('PATCH', collectionAdminBase + '/' + selectedId.value, { ...value, version: book.value.version })
  }
  async function saveOrder(articleIds: string[]) {
    if (book.value) await perform('PUT', collectionAdminBase + '/' + book.value._id + '/order', { articleIds, version: book.value.version })
  }
  async function changeMembership(id: string, target: string | null) {
    await perform('PUT', articleAdminBase + '/' + id + '/collection', { collectionId: target, expectedCollectionId: selectedId.value || null })
  }
  async function add(id: string) {
    if (!id || !selectedId.value) return
    await perform('PUT', articleAdminBase + '/' + id + '/collection', { collectionId: selectedId.value, expectedCollectionId: null })
  }
  async function removeBook() {
    if (book.value) await perform('DELETE', collectionAdminBase + '/' + book.value._id, { version: book.value.version })
  }
  async function repair() { if (selectedId.value) await perform('POST', collectionAdminBase + '/' + selectedId.value + '/repair', {}) }
  onMounted(() => refresh())
  return { books, book, entries, selectedId, loading, loadError, write, locked, available, select, refresh, recover, saveMetadata, saveOrder, changeMembership, add, removeBook, repair }
}
