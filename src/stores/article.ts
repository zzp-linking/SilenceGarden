import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_ARTICLE_DETAILS, GET_REVISE_ARTICLE_DETAILS, GET_ARTICLE_CATALOG, ARTICLE_SAVE, ARTICLE_IMAGE_UPLOAD } from '@/config/url'
import { useGlobalStore } from './global'
import type { IdParams } from '@/types/api'
import { emptyArticleDetail, type ArticleCatalogItem, type ArticleDetail, type ArticleEditDetail, type ArticleImageUploadInput, type ArticleImageUploadResult, type ArticleSaveInput, type ArticleSaveRequest, type ArticleSaveTarget, type ArticleWriteResult } from '@/types/article'

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
}

export const useArticleStore = defineStore('article', {
  state: (): ArticleState => ({
    catalog: [],
    article: emptyArticleDetail(),
    get_article_loading: false,
    upload_image: '',
    pos: 0
  }),
  actions: {
    /** 按调用方明确传入的创建/编辑目标保存；不读取上一次编辑留下的 ID。 */
    async articleSave(input: ArticleSaveInput, target: ArticleSaveTarget): Promise<ArticleWriteResult | void> {
      const id = target.mode === 'edit' ? target.id.trim() : ''
      if (target.mode === 'edit' && !id) throw new Error('缺少待编辑文章的 ID')
      const request: ArticleSaveRequest = { ...input, id }
      const result = await net.post<ArticleSaveResult, ArticleSaveRequest>(ARTICLE_SAVE, request)
      if (target.mode === 'create' && (!result || typeof result.id !== 'string' || !result.id)) throw new Error('文章创建结果无效')
      if (target.mode === 'edit' && (!result || result.updated !== true || result.matchedCount !== 1)) throw new Error('文章不存在或已删除')
      return result
    },
    /** 拉取文章目录，并通过全局 Store 驱动页面加载遮罩。 */
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
    /** 根据文章 ID 加载阅读页所需的 HTML 详情。 */
    async getArticleDetails(params: IdParams, signal?: AbortSignal): Promise<void> {
      const globalStore = useGlobalStore()
      this.article = emptyArticleDetail()
      this.get_article_loading = true
      globalStore.setLoading(true)
      try {
        const result = await net.get<ArticleDetail>(restful(GET_ARTICLE_DETAILS, params), { signal })
        if (result && !signal?.aborted) this.article = result
      } finally {
        if (!signal?.aborted) this.get_article_loading = false
        globalStore.setLoading(false)
      }
    },
    /** 返回当前目标的编辑源；由页面决定是否采用迟到的结果。 */
    async getReviseArticleDetails(params: IdParams, signal?: AbortSignal): Promise<ArticleEditDetail> {
      const result = await net.get<Partial<ArticleEditDetail>>(restful(GET_REVISE_ARTICLE_DETAILS, params), { signal })
      if (!result || typeof result.title !== 'string') throw new Error('文章不存在或已删除')
      return {
        collectionId: result.collectionId ?? null,
        title: result.title,
        markdown: typeof result.markdown === 'string' ? result.markdown : '',
        tags: Array.isArray(result.tags) ? result.tags.filter((tag): tag is string => typeof tag === 'string') : []
      }
    },
    /** 上传编辑器图片，并保存编辑器回填所需的位置标识。 */
    async articleImageUpload({ formdata, pos }: ArticleImageUploadInput): Promise<void> {
      const result = await net.post<ArticleImageUploadResult, FormData>(ARTICLE_IMAGE_UPLOAD, formdata)
      if (result) {
        this.upload_image = result.image
        this.pos = pos
      }
    }
  }
})
