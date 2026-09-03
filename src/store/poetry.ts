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
    setKeyword(value: string): void {
      this.keyword = value
    }
  }
})
