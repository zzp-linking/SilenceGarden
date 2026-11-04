import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import net, { ApiError } from '@/utils/net'
import { collectionsApi, collectionAdminBase } from '@/api/articleCollections'
import { useUserStore } from '@/stores/user'
import { useArticleOperation } from './useArticleOperation'

function setup() {
  let writer!: ReturnType<typeof useArticleOperation>
  const wrapper = mount(defineComponent({ setup() { writer = useArticleOperation('test'); return () => h('div') } }))
  return { writer, wrapper }
}
beforeEach(() => {
  setActivePinia(createPinia()); sessionStorage.clear(); vi.restoreAllMocks()
  useUserStore().user = { id: 'admin-a', account: 'admin', role: 'admin' }
})
describe('stable write recovery', () => {
  it('restores the frozen command after refresh and queries its receipt without creating again', async () => {
    const post = vi.spyOn(net, 'request').mockRejectedValue(new ApiError('SYNC_PENDING', '继续同步', { state: 'pending', articleId: 'article-a', contentSaved: true }))
    const first = setup()
    const data = { title: '原标题' }
    await expect(first.writer.execute('POST', collectionAdminBase, data)).rejects.toThrow('继续同步')
    data.title = '新标题'
    expect(first.writer.snapshot.value?.title).toBe('原标题')
    first.wrapper.unmount()
    const second = setup()
    expect(second.writer.pending.value).toBe(true)
    const query = vi.spyOn(collectionsApi, 'operation').mockResolvedValue({ state: 'complete', articleId: 'article-a' })
    await second.writer.recover()
    expect(query).toHaveBeenCalledWith(expect.any(String))
    expect(post).toHaveBeenCalledTimes(1)
    expect(second.writer.pending.value).toBe(false)
    second.wrapper.unmount()
  })
  it('retries an unregistered request using the exact same request ID and snapshot', async () => {
    const request = vi.spyOn(net, 'request').mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ state: 'complete', id: 'book-a' })
    vi.spyOn(collectionsApi, 'operation').mockRejectedValue(new ApiError('OPERATION_NOT_FOUND', '未登记', {}))
    const { writer, wrapper } = setup()
    await expect(writer.execute('POST', collectionAdminBase, { title: '书' })).rejects.toThrow('timeout')
    await writer.recover()
    expect(request.mock.calls[1]?.[2]).toEqual(request.mock.calls[0]?.[2])
    expect(writer.pending.value).toBe(false)
    wrapper.unmount()
  })
  it('clears a terminal conflict and never shares a pending write with another account', async () => {
    vi.spyOn(net, 'request').mockRejectedValue(new ApiError('VERSION_CONFLICT', '版本变化', { state: 'failed' }))
    const first = setup()
    await expect(first.writer.execute('PUT', collectionAdminBase + '/book/order', { articleIds: [] })).rejects.toThrow()
    expect(first.writer.pending.value).toBe(false)
    vi.spyOn(net, 'request').mockRejectedValue(new Error('timeout'))
    await expect(first.writer.execute('POST', collectionAdminBase, { title: '书' })).rejects.toThrow()
    first.wrapper.unmount()
    useUserStore().user = { id: 'admin-b', account: 'second', role: 'admin' }
    const second = setup()
    expect(second.writer.pending.value).toBe(false)
    second.wrapper.unmount()
  })
})

