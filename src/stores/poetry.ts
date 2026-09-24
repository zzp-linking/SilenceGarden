import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_POEM, GET_POETRY_CATALOG, GET_POETRY_CATALOG_VAGUE } from '@/config/url'
import { useGlobalStore } from './global'
import type { KeywordParams, TitleParams } from '@/types/api'
import { emptyPoetry, type Poetry, type PoetryCatalogItem } from '@/types/poetry'

interface PoetryState {
  catalog: PoetryCatalogItem[]
  keyword: string
  poem: Poetry
}

export const usePoetryStore = defineStore('poetry', {
  state: (): PoetryState => ({ catalog: [], keyword: '', poem: emptyPoetry() }),
  actions: {
    /** 加载完整诗词目录。 */
    async getPoetryCatalog(): Promise<void> {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get<PoetryCatalogItem[]>(GET_POETRY_CATALOG)
        if (Array.isArray(result)) this.catalog = result
      } finally {
        globalStore.setLoading(false)
      }
    },
    /** 按关键词加载过滤后的诗词目录。 */
    async getPoetryCatalogByKeyword(params: KeywordParams): Promise<void> {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get<PoetryCatalogItem[]>(restful(GET_POETRY_CATALOG_VAGUE, params))
        if (Array.isArray(result)) this.catalog = result
      } finally {
        globalStore.setLoading(false)
      }
    },
    /** 按标题加载阅读页正文，开始请求前先清除上一首内容。 */
    async getPoemByTitle(params: TitleParams): Promise<void> {
      const globalStore = useGlobalStore()
      this.poem = emptyPoetry()
      globalStore.setLoading(true)
      try {
        const result = await net.get<Poetry>(restful(GET_POEM, params))
        if (result) this.poem = result
      } finally {
        globalStore.setLoading(false)
      }
    },
    /** 保存目录搜索关键词，供页面和路由切换后复用。 */
    setKeyword(value: string): void {
      this.keyword = value
    }
  }
})
