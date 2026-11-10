import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import type { AgentArtifact } from '@/features/agent/chat/model'
import MessageResources from './MessageResources.vue'

const fetcher = vi.hoisted(() => vi.fn()) // 隔离 HTTP 响应，保留客户端真实的 Cookie 续期逻辑。
vi.mock('@/api/clientV2', async importOriginal => {
  const actual = await importOriginal<typeof import('@/api/clientV2')>()
  return { ...actual, clientV2: new actual.ClientV2({ fetcher }) }
})

afterEach(() => {
  fetcher.mockReset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 返回一份点击时仍有效的附件元数据。 */
function validAttachment(): AgentArtifact {
  return {
    asset_id: '01900000-0000-7000-8000-000000000001',
    name: '公开示例.pdf',
    media_type: 'application/pdf',
    byte_size: 8,
    expires_at: new Date(Date.now() + 60_000).toISOString()
  }
}

/** 确认真实按钮触发下载，经过 GET、刷新、GET 后才交给浏览器保存。 */
it('访问 Cookie 过期时先刷新会话再下载附件', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const file = validAttachment()
  const path = `/home/api/agent/assets/${file.asset_id}/download`
  fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response('%PDF-123', { headers: { 'Content-Type': 'application/pdf' } }))
  const create = vi.fn(() => 'blob:agent-fixture')
  const revoke = vi.fn()
  const BrowserURL = URL
  vi.stubGlobal('URL', class extends BrowserURL {
    static createObjectURL = create // 捕获传给浏览器的附件内容。
    static revokeObjectURL = revoke // 验证下载后释放临时地址。
  })
  const save = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.href).toBe('blob:agent-fixture')
    expect(this.download).toBe(file.name)
  })
  const wrapper = mount(MessageResources, { props: { artifacts: [file] } })
  try {
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(fetcher.mock.calls.map(([url, init]) => [url, init.method ?? 'GET', init.credentials])).toEqual([
      [path, 'GET', 'include'],
      ['/home/api/session/refresh', 'POST', 'include'],
      [path, 'GET', 'include']
    ])
    expect(create).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(revoke).toHaveBeenCalledWith('blob:agent-fixture')
  } finally {
    wrapper.unmount()
  }
})

/** 刷新凭证失效时，错误留在对话附件处且不打开错误响应。 */
it('会话刷新失败时在附件处显示登录错误', async () => {
  const body = JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: '请先登录' } })
  fetcher.mockResolvedValueOnce(new Response(body, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  const save = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const wrapper = mount(MessageResources, { props: { artifacts: [validAttachment()] } })
  try {
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role=alert]').text()).toBe('请先登录')
    expect(save).not.toHaveBeenCalled()
  } finally {
    wrapper.unmount()
  }
})
