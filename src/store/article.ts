import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_ARTICLE_DETAILS, GET_REVISE_ARTICLE_DETAILS, GET_ARTICLE_CATALOG, ARTICLE_SAVE, ARTICLE_IMAGE_UPLOAD } from '@/config/url'
import { message } from '@/utils/talk'
import router from '@/router'
import { useGlobalStore } from './global'
import type { IdParams } from '@/types/api'
import { emptyArticleDetail, emptyArticleEditDetail, type ArticleCatalogItem, type ArticleDetail, type ArticleEditDetail, type ArticleImageUploadInput, type ArticleImageUploadResult, type ArticleSaveInput, type ArticleSaveRequest } from '@/types/article'

interface ArticleSaveResult {
  id?: string
  updated?: boolean
  matchedCount?: number
}

interface ArticleState {
  catalog: ArticleCatalogItem[]
  article: ArticleDetail
  get_article_loading: boolean
  upload_image: string
  pos: string | number
  id: string
  revise_article: ArticleEditDetail
}

export const useArticleStore = defineStore('article', {
  state: (): ArticleState => ({
    catalog: [],
    article: emptyArticleDetail(),
    get_article_loading: false,
    upload_image: '',
    pos: 0,
    id: '',
    revise_article: emptyArticleEditDetail()
  }),
  actions: {
    async articleSave(input: ArticleSaveInput): Promise<void> {
      const request: ArticleSaveRequest = { ...input, id: this.id }
      const result = await net.post<ArticleSaveResult, ArticleSaveRequest>(ARTICLE_SAVE, request)
      if (result) message('保存文章成功！', 2, () => { void router.push('/article') })
    },
    async getArticleCatalog(): Promise<void> {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get<ArticleCatalogItem[]>(GET_ARTICLE_CATALOG)
        if (Array.isArray(result)) this.catalog = result
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getArticleDetails(params: IdParams): Promise<void> {
      const globalStore = useGlobalStore()
      this.article = emptyArticleDetail()
      globalStore.setLoading(true)
      try {
        const result = await net.get<ArticleDetail>(restful(GET_ARTICLE_DETAILS, params))
        if (result) this.article = result
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getReviseArticleDetails(params: IdParams): Promise<void> {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get<ArticleEditDetail>(restful(GET_REVISE_ARTICLE_DETAILS, params))
        if (result) {
          this.revise_article = result
          this.id = params.id
        }
      } finally {
        globalStore.setLoading(false)
      }
    },
    async articleImageUpload({ formdata, pos }: ArticleImageUploadInput): Promise<void> {
      const result = await net.post<ArticleImageUploadResult, FormData>(ARTICLE_IMAGE_UPLOAD, formdata)
      if (result) {
        this.upload_image = result.image
        this.pos = pos
      }
    }
  }
})
