import net from '@/utils/net'
import { BASEURL, AUTH } from '@/config/url'
import type { ArticleCatalogItem, ArticleCollection, ArticleWriteResult } from '@/types/article'

export const articleAdminBase = BASEURL + AUTH + '/article'
export const collectionAdminBase = articleAdminBase + '/collections'

export const collectionsApi = {
  list: () => net.get<ArticleCollection[]>(collectionAdminBase),
  entries: () => net.get<ArticleCatalogItem[]>(articleAdminBase + '/entries'),
  async detail(id: string, admin = false, signal?: AbortSignal): Promise<ArticleCollection> {
    const url = admin ? collectionAdminBase + '/' + encodeURIComponent(id)
      : BASEURL + '/article/collection/' + encodeURIComponent(id)
    const value = await net.get<ArticleCollection>(url, { signal })
    return { ...value, articleIds: value.articleIds ?? [], items: value.items ?? [] }
  },
  operation: (requestId: string, retry = false) => retry
    ? net.post<ArticleWriteResult>(articleAdminBase + '/operations/' + encodeURIComponent(requestId) + '/retry', {})
    : net.get<ArticleWriteResult>(articleAdminBase + '/operations/' + encodeURIComponent(requestId))
}

