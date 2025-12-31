import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_POEM, GET_POETRY_CATALOG, GET_POETRY_CATALOG_VAGUE } from '@/config/url'
import { useGlobalStore } from './global'

export const usePoetryStore = defineStore('poetry', {
  state: () => ({
    catalog: [],
    keyword: '',
    poem: {
      title: '',
      content: [],
      section: false
    }
  }),
  actions: {
    async getPoetryCatalog() {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get(GET_POETRY_CATALOG)
        if (result) {
          this.catalog = result
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getPoetryCatalogByKeyword(obj) {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get(restful(GET_POETRY_CATALOG_VAGUE, obj))
        if (result) {
          this.catalog = result
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getPoemByTitle(obj) {
      const globalStore = useGlobalStore()
      this.poem = { title: '', content: [], section: false }
      globalStore.setLoading(true)
      try {
        const result = await net.get(restful(GET_POEM, obj))
        if (result) {
          this.poem = result
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    setKeyword(value) {
      this.keyword = value
    }
  }
})

