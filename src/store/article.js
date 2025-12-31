import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_ARTICLE_DETAILS, GET_REVISE_ARTICLE_DETAILS, GET_ARTICLE_CATALOG,
         ARTICLE_SAVE, ARTICLE_IMAGE_UPLOAD } from '@/config/url'
import { message } from '@/utils/talk'
import router from '@/router'

import { useGlobalStore } from './global'

export const useArticleStore = defineStore('article', {
  state: () => ({
    catalog: [],
    article: {},
    get_article_loading: false, // 页面内部使用的局部 loading
    upload_image: '',
    pos: 0,
    id: '', 
    revise_article: {}, 
  }),
  actions: {
    async articleSave(obj) {
      const globalStore = useGlobalStore()
      const id = this.id
      try {
        const result = await net.post(ARTICLE_SAVE, { ...obj, id })
        if (result) {
          message('保存文章成功！', 2, () => router.push('/article'))
        }
      } catch (e) {
        console.error(e)
      }
    },
    async getArticleCatalog() {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get(GET_ARTICLE_CATALOG)
        if (result) {
          this.catalog = result
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getArticleDetails(obj) {
      const globalStore = useGlobalStore()
      this.article = {}
      globalStore.setLoading(true)
      try {
        const result = await net.get(restful(GET_ARTICLE_DETAILS, obj))
        if (result) {
          this.article = result
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getReviseArticleDetails(obj) {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get(restful(GET_REVISE_ARTICLE_DETAILS, obj))
        if (result) {
          this.revise_article = result
          this.id = obj.id
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    async articleImageUpload({ formdata, pos }) {
      try {
        // 注意：axios 上传 formdata 不需要特殊设置，它会自动处理 content-type
        const result = await net.post(ARTICLE_IMAGE_UPLOAD, formdata)
        if (result) {
          this.upload_image = result.image
          this.pos = pos
        }
      } catch (e) {
        console.error(e)
      }
    }
  }
})

