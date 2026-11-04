import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import net from '@/utils/net'
import { ARTICLE_SAVE } from '@/config/url'
import { useArticleStore } from './article'

const input = { title: '文章', tags: ['标签'], markdown: '# 文章', html: '<h1>文章</h1>' }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('article save target', () => {
  it('sends no old ID when creating and the chosen ID when editing', async () => {
    const post = vi.spyOn(net, 'post')
      .mockResolvedValueOnce({ id: 'new-article' })
      .mockResolvedValueOnce({ updated: true, matchedCount: 1 })
    const store = useArticleStore()

    await store.articleSave(input, { mode: 'create' })
    await store.articleSave(input, { mode: 'edit', id: 'article-a' })

    expect(post).toHaveBeenNthCalledWith(1, ARTICLE_SAVE, { ...input, id: '' })
    expect(post).toHaveBeenNthCalledWith(2, ARTICLE_SAVE, { ...input, id: 'article-a' })
  })

  it('does not report success when the update matched nothing', async () => {
    vi.spyOn(net, 'post').mockResolvedValue({ updated: true, matchedCount: 0 })
    await expect(useArticleStore().articleSave(input, { mode: 'edit', id: 'missing' }))
      .rejects.toThrow('文章不存在或已删除')
  })
})
