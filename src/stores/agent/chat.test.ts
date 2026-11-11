import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAgentChatStore } from './chat'
import { agentChatApi } from '@/api/agentChat'
import { V2HttpError } from '@/api/clientV2'
import { useUserStore } from '@/stores/user'
import type { AgentRun, AgentChat, AgentMessage } from '@/features/agent/chat/model'

/** Capture subscription observers to exercise delayed off-screen events without a network model. */
const observers = vi.hoisted(() => new Map<string, { update: (run: AgentRun) => void }>())

vi.mock('@/api/agentChat', () => ({ agentChatApi: { send: vi.fn(), get: vi.fn(), run: vi.fn(), bootstrap: vi.fn(), list: vi.fn(), active: vi.fn(), create: vi.fn(), messages: vi.fn(), save: vi.fn(), preference: vi.fn(), remove: vi.fn() } }))
vi.mock('@/features/agent/chat/subscriptions', () => ({ RunSubscription: class {
  constructor(run: AgentRun, observer: { update: (run: AgentRun) => void }) { observers.set(run.run_id, observer) }
  close = vi.fn(); start = vi.fn().mockResolvedValue(undefined)
} }))
/** Initialize only the process-local state needed for admission and account epoch checks. */
function workspace() {
  const store = useAgentChatStore()
  store.bootstrap = { instance_id: 'i1', available: true, limits: { max_input_bytes: 16384, user_concurrency: 2, user_max_chats: 12, max_messages: 128 } }
  store.chats.c1 = { chat_id: 'c1', title: 'one', revision: 1, updated_at: '', messages: [] }
  store.selected = 'c1'; store.drafts.c1 = 'hello'
  return store
}
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks(); observers.clear() })
describe('Agent account-scoped workspace', () => {
  it('不确定接纳重试保持原模式，生成终态仍等待保存', async () => {
    const store = workspace()
    store.bootstrap!.model = { model: 'fake', thinking_enabled: true, thinking_allowed: true }
    store.chats.c1.thinking_preference = true
    vi.mocked(agentChatApi.send).mockRejectedValueOnce(new TypeError('offline'))
    await expect(store.send()).rejects.toThrow('offline')
    const key = store.pending.c1.key
    store.chats.c1.thinking_preference = false
    const run = { run_id: 'r1', chat_id: 'c1', instance_id: 'i1', message_id: 'a1', user_message_id: 'u1', status: 'completed', persistence_status: 'failed', answer: '正文仍在', reasoning: '', event_seq: 9, model: {} } as AgentRun
    vi.mocked(agentChatApi.send).mockResolvedValue(run); vi.mocked(agentChatApi.get).mockResolvedValue({ ...store.chats.c1, current_run_id: 'r1' }); vi.mocked(agentChatApi.run).mockResolvedValue(run)
    await store.send()
    expect(agentChatApi.send).toHaveBeenLastCalledWith('i1', 'c1', 'hello', key, expect.any(AbortSignal), true)
    expect(store.current.current_run_id).toBe('r1')
    vi.mocked(agentChatApi.save).mockResolvedValue({ ...run, source: 'history', persistence_status: 'saved', event_seq: 7 })
    await store.save('r1')
    expect(store.current.current_run_id).toBeUndefined(); expect(store.runs.r1.persistence_status).toBe('saved'); store.dispose()
  })
  it('更早历史只补未知消息，迟到删除响应后不复活会话', async () => {
    const store = workspace()
    store.chats.c1.next_cursor = 10
    store.chats.c1.messages = [{ message_id: 'live', message_seq: 11, role: 'assistant', text: '最新输出', reasoning: '', run_id: 'r', status: 'running' }]
    vi.mocked(agentChatApi.messages).mockResolvedValue({ items: [{ message_id: 'old', message_seq: 1, role: 'user', text: '旧问题', reasoning: '', run_id: 'old', status: 'completed' }, { ...store.chats.c1.messages[0], text: '旧快照' }], watermark: 11 })
    await store.older('c1')
    expect(store.current.messages?.map(m => m.text)).toEqual(['旧问题', '最新输出'])
    const slow = deferred<AgentChat>(); vi.mocked(agentChatApi.get).mockReturnValue(slow.promise)
    const refresh = store.select('c1'); vi.mocked(agentChatApi.remove).mockResolvedValue(store.chats.c1)
    await store.remove('c1'); slow.resolve({ chat_id: 'c1', title: '旧响应', revision: 99, updated_at: '' }); await refresh
    expect(store.chats.c1).toBeUndefined(); store.dispose()
  })
  it('MCP 授权随原幂等键重试，下一次发送默认关闭', async () => {
    const store = workspace()
    vi.mocked(agentChatApi.send).mockRejectedValueOnce(new TypeError('offline'))
    await expect(store.send(false, false, true)).rejects.toThrow('offline')
    const key = store.pending.c1.key // 记录首次开启 MCP 时的接纳键。
    expect(store.pending.c1.mcp).toBe(true)

    const accepted = { run_id: 'mcp', chat_id: 'c1', instance_id: 'i1', message_id: 'a1',
      user_message_id: 'u1', status: 'completed', persistence_status: 'saved', answer: '已完成',
      reasoning: '', event_seq: 1, model: {} } as AgentRun
    vi.mocked(agentChatApi.send).mockResolvedValueOnce(accepted)
    vi.mocked(agentChatApi.get).mockResolvedValue(store.chats.c1)
    await store.send()
    expect(agentChatApi.send).toHaveBeenLastCalledWith('i1', 'c1', 'hello', key, expect.any(AbortSignal), false, false, false, true)
    expect(store.pending.c1).toBeUndefined()

    store.drafts.c1 = 'next'
    vi.mocked(agentChatApi.send).mockResolvedValueOnce({ ...accepted, run_id: 'next', message_id: 'a2' })
    await store.send()
    expect(agentChatApi.send).toHaveBeenLastCalledWith('i1', 'c1', 'next', expect.not.stringMatching(key), expect.any(AbortSignal), false)
    store.dispose()
  })
  it('keeps the exact idempotency key after uncertain POST and clears draft only on accepted response', async () => {
    const store = workspace()
    vi.mocked(agentChatApi.send).mockRejectedValueOnce(new TypeError('offline'))
    await expect(store.send()).rejects.toThrow('offline')
    const key = store.pending.c1.key; expect(store.drafts.c1).toBe('hello')
    const accepted = { run_id: 'r1', chat_id: 'c1', instance_id: 'i1', message_id: 'a1', user_message_id: 'u1', status: 'running', answer: '', reasoning: '', event_seq: 1, model: {} } as AgentRun
    vi.mocked(agentChatApi.send).mockResolvedValue(accepted); vi.mocked(agentChatApi.get).mockResolvedValue(store.chats.c1); vi.mocked(agentChatApi.run).mockResolvedValue(accepted)
    await store.send(); expect(agentChatApi.send).toHaveBeenLastCalledWith('i1', 'c1', 'hello', key, expect.any(AbortSignal), false); expect(store.drafts.c1).toBe(''); expect(store.runs.r1.run_id).toBe('r1'); store.dispose()
  })
  it('invalidates old asynchronous results and in-memory drafts on account change', async () => {
    const user = useUserStore(); user.setUser({ id: 'old', account: 'old', role: 'demo_user' })
    const store = workspace(); let resolve!: (value: AgentRun) => void
    vi.mocked(agentChatApi.send).mockReturnValue(new Promise(done => { resolve = done }))
    const pending = store.send(); user.setUser({ id: 'new', account: 'new', role: 'demo_user' })
    resolve({ run_id: 'old-run' } as AgentRun); await pending
    expect(Object.keys(store.runs)).toHaveLength(0); expect(Object.keys(store.drafts)).toHaveLength(0); expect(store.bootstrap).toBeNull(); store.dispose()
  })
  it('isolates concurrent chats and prevents a delayed old terminal event from clearing a newer run', async () => {
    const store = workspace()
    const first = { run_id: 'old', chat_id: 'c1', instance_id: 'i1', message_id: 'a1', user_message_id: 'u1', status: 'running', answer: 'old', reasoning: '', event_seq: 1, model: {} } as AgentRun
    vi.mocked(agentChatApi.send).mockResolvedValueOnce(first); vi.mocked(agentChatApi.get).mockResolvedValueOnce({ ...store.chats.c1, current_run_id: 'old' }); vi.mocked(agentChatApi.run).mockResolvedValueOnce(first)
    await store.send(); observers.get('old')!.update({ ...first, status: 'completed', event_seq: 2 })
    const second = { ...first, run_id: 'new', message_id: 'a2', answer: 'new' }
    store.drafts.c1 = 'next'; vi.mocked(agentChatApi.send).mockResolvedValueOnce(second); vi.mocked(agentChatApi.get).mockResolvedValueOnce({ ...store.chats.c1, current_run_id: 'new' }); vi.mocked(agentChatApi.run).mockResolvedValueOnce(second)
    await store.send(); observers.get('old')!.update({ ...first, status: 'completed', event_seq: 3 })
    expect(store.chats.c1.current_run_id).toBe('new'); expect(store.runs.new.answer).toBe('new'); store.dispose()
  })
})

/** 延迟响应精确控制请求顺序，复现 REST 快照覆盖本地新状态的竞争。 */
function deferred<T>() {
  let resolve!: (value: T) => void // 由测试显式释放响应。
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
/** 建立已收到部分输出的旧进程会话，保留两条已保存历史和一轮未收尾消息。 */
async function liveWorkspace() {
  const store = workspace()
  const run = { run_id: 'r1', chat_id: 'c1', instance_id: 'i1', user_message_id: 'u3', message_id: 'a4', status: 'running', persistence_status: 'pending', source: 'memory', replay_available: true, answer: '部分输出', reasoning: '部分思考', event_seq: 5, model: {} } as AgentRun
  const chat: AgentChat = { ...store.chats.c1, revision: 2, current_run_id: 'r1', watermark: 3, messages: [
    { message_id: 'u1', message_seq: 1, role: 'user', text: '历史问题', reasoning: '', run_id: 'old', status: 'completed' },
    { message_id: 'a2', message_seq: 2, role: 'assistant', text: '已保存历史回答', reasoning: '', run_id: 'old', status: 'completed' },
    { message_id: 'u3', message_seq: 3, role: 'user', text: '本轮问题', reasoning: '', run_id: 'r1', status: 'completed' },
    { message_id: 'a4', message_seq: 4, role: 'assistant', text: '', reasoning: '', run_id: 'r1', status: 'running' }
  ] }
  vi.mocked(agentChatApi.get).mockResolvedValueOnce(chat)
  vi.mocked(agentChatApi.run).mockResolvedValueOnce(run)
  await store.select('c1')
  return { store, run, observer: observers.get('r1')! }
}

describe('进程重启恢复', () => {
  it('已提交历史引用优先于保存后迟到的内存运行投影', async () => {
    const { store, run, observer } = await liveWorkspace()
    const stale: AgentRun = { ...run, status: 'failed', persistence_status: 'saved', event_seq: 9, sources: undefined }
    observer.update(stale)
    const source = { id: 's1', title: '数据库恢复的来源', document_id: 'd1', chunk_id: 'c1', index_version_id: 'v1' }
    const committed: AgentMessage = {
      message_id: run.message_id, message_seq: 6, role: 'assistant', text: '已提交的事实', reasoning: '',
      run_id: run.run_id, status: 'failed', sources: [source]
    }
    vi.mocked(agentChatApi.get).mockResolvedValueOnce({
      ...store.chats.c1, revision: 3, watermark: 6, current_run_id: undefined,
      messages: [...store.current.messages!.filter(message => message.message_id !== run.message_id), committed]
    })
    await store.select('c1')
    expect(store.current.messages?.find(message => message.message_id === run.message_id)).toMatchObject({
      message_seq: 6, text: '已提交的事实', sources: [source]
    })
    observer.update({ ...stale, event_seq: 10 })
    expect(store.current.messages?.find(message => message.message_id === run.message_id)?.sources).toEqual([source])
    store.dispose()
  })

  it('新世代撤销所有旧消息页，只从PG恢复已保存内容并忽略迟到旧流', async () => {
    const { store, run, observer } = await liveWorkspace()
    observer.update({ ...run, status: 'completed', persistence_status: 'failed', answer: '未保存的回答', event_seq: 10 })
    const other: AgentChat = { chat_id: 'c2', title: '另一会话', revision: 1, updated_at: '' }
    store.chats.c2 = { ...other, current_run_id: 'r2', messages: [{ message_id: 'other-phantom', message_seq: 2, role: 'assistant', text: '另一会话未保存输出', reasoning: '', run_id: 'r2', status: 'completed' }] }
    store.drafts.c2 = '另一会话草稿'
    const head: AgentChat = { chat_id: 'c1', title: 'one', revision: 3, updated_at: '' }
    const persisted: AgentChat = { ...head, watermark: 3, messages: store.current.messages!.filter(message => message.message_id !== 'a4').map(message => message.message_id === 'u3' ? { ...message, status: 'interrupted' } : { ...message }) }
    vi.mocked(agentChatApi.bootstrap).mockResolvedValue({ ...store.bootstrap!, instance_id: 'i2', persistent_history: true })
    vi.mocked(agentChatApi.list).mockResolvedValueOnce({ items: [head, other] })
    vi.mocked(agentChatApi.active).mockResolvedValueOnce({ items: [] })
    vi.mocked(agentChatApi.get).mockResolvedValueOnce(persisted)
    await store.restore()
    expect(store.bootstrap?.instance_id).toBe('i2')
    expect(store.selected).toBe('c1')
    expect(store.current.messages?.map(message => message.message_id)).toEqual(['u1', 'a2', 'u3'])
    expect(store.current.messages?.find(message => message.message_id === 'u3')?.status).toBe('interrupted')
    expect(store.current.messages?.find(message => message.message_id === 'a2')?.text).toBe('已保存历史回答')
    expect(store.chats.c2.messages).toBeUndefined()
    expect(store.chats.c2.current_run_id).toBeUndefined()
    expect(store.drafts.c1).toBe('hello'); expect(store.drafts.c2).toBe('另一会话草稿')
    observer.update({ ...run, status: 'completed', answer: '迟到旧回答', event_seq: 100 })
    expect(store.runs.r1).toBeUndefined()
    expect(store.current.messages?.some(message => message.message_id === 'a4')).toBe(false)
    store.dispose()
  })

  it('断线先取得历史中断快照时移除未落库助手投影，不伪造空回答', async () => {
    const { store, run, observer } = await liveWorkspace()
    observer.update({ ...run, source: 'history', status: 'interrupted', persistence_status: 'saved', replay_available: false, answer: '', reasoning: '', event_seq: 1, reason: '服务重启，未提交输出不可恢复' })
    expect(store.current.messages?.map(message => message.message_id)).toEqual(['u1', 'a2', 'u3'])
    expect(store.current.messages?.find(message => message.message_id === 'u3')?.status).toBe('interrupted')
    expect(store.current.current_run_id).toBeUndefined()
    expect(store.runs.r1.status).toBe('interrupted')
    expect(store.runs.r1.event_seq).toBe(1)
    store.dispose()
  })

  it('不确定POST遇到410后跨世代复用原key和原模式核对已保存请求', async () => {
    const store = workspace()
    store.bootstrap!.model = { model: 'fake', thinking_enabled: true, thinking_allowed: true }
    store.chats.c1.thinking_preference = true
    vi.mocked(agentChatApi.send).mockRejectedValueOnce(new TypeError('response lost'))
    await expect(store.send()).rejects.toThrow('response lost')
    const originalKey = store.pending.c1.key
    const changed = new V2HttpError(410, { code: 'AGENT_INSTANCE_CHANGED', message: '运行连接已过期', retryable: false })
    vi.mocked(agentChatApi.send).mockRejectedValueOnce(changed)
    await expect(store.send()).rejects.toBe(changed)
    expect(store.pending.c1.key).toBe(originalKey)
    const head: AgentChat = { chat_id: 'c1', title: 'one', revision: 3, updated_at: '', thinking_preference: false }
    const persisted: AgentChat = { ...head, watermark: 2, messages: [
      { message_id: 'u1', message_seq: 1, role: 'user', text: 'hello', reasoning: '', run_id: 'saved', status: 'completed' },
      { message_id: 'a1', message_seq: 2, role: 'assistant', text: '之前已保存的回答', reasoning: '', run_id: 'saved', status: 'completed' }
    ] }
    vi.mocked(agentChatApi.bootstrap).mockResolvedValueOnce({ ...store.bootstrap!, instance_id: 'i2', persistent_history: true, model: { model: 'fake', thinking_enabled: false, thinking_allowed: false } })
    vi.mocked(agentChatApi.list).mockResolvedValueOnce({ items: [head] })
    vi.mocked(agentChatApi.active).mockResolvedValueOnce({ items: [] })
    vi.mocked(agentChatApi.get).mockResolvedValue(persisted)
    await store.report(changed)
    expect(store.pending.c1).toMatchObject({ key: originalKey, text: 'hello', thinking: true })
    expect(store.drafts.c1).toBe('hello')
    const saved = { run_id: 'saved', chat_id: 'c1', instance_id: 'i1', user_message_id: 'u1', message_id: 'a1', status: 'completed', persistence_status: 'saved', source: 'history', replay_available: false, answer: '之前已保存的回答', reasoning: '', event_seq: 4, model: {} } as AgentRun
    vi.mocked(agentChatApi.send).mockResolvedValueOnce(saved)
    await store.send()
    expect(agentChatApi.send).toHaveBeenLastCalledWith('i2', 'c1', 'hello', originalKey, expect.any(AbortSignal), true)
    expect(store.pending.c1).toBeUndefined(); expect(store.drafts.c1).toBe('')
    expect(store.current.messages).toHaveLength(2)
    expect(store.runs.saved.source).toBe('history')
    store.dispose()
  })
})

describe('会话刷新并发保护', () => {
  it('刷新最新页出现断档后保留补页入口，补齐后保持所有旧消息', async () => {
    const store = workspace()
    /** 生成具有固定ID和序号的独立消息，便于核对分页缺口。 */
    const messages = (first: number, last: number): AgentMessage[] => Array.from({ length: last - first + 1 }, (_, index) => ({
      message_id: `m${first + index}`, message_seq: first + index, role: 'user', text: `问题${first + index}`, reasoning: '', run_id: 'history', status: 'completed'
    }))
    vi.mocked(agentChatApi.get).mockResolvedValueOnce({ ...store.chats.c1, messages: messages(1, 40), watermark: 40 })
    await store.select('c1')
    vi.mocked(agentChatApi.get).mockResolvedValueOnce({ ...store.chats.c1, revision: 2, messages: messages(61, 100), next_cursor: 61, watermark: 100 })
    await store.select('c1')
    expect(store.current.messages).toHaveLength(80)
    expect(store.current.next_cursor).toBe(61)
    vi.mocked(agentChatApi.messages).mockResolvedValueOnce({ items: messages(21, 60), next_cursor: 21, watermark: 100 })
    await store.older('c1')
    expect(agentChatApi.messages).toHaveBeenLastCalledWith('c1', 61, expect.any(AbortSignal))
    expect(store.current.messages?.map(message => message.message_seq)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
    expect(store.current.next_cursor).toBeUndefined()
    store.dispose()
  })

  it('直达链接中的旧会话不在列表首屏时仍按ID恢复目标', async () => {
    const store = workspace()
    delete store.chats.c1; store.selected = ''
    const recent: AgentChat = { chat_id: 'recent', title: '首屏会话', revision: 1, updated_at: '2026-11-07' }
    const target: AgentChat = { chat_id: 'old', title: '较早的目标', revision: 1, updated_at: '2026-11-01', messages: [] }
    vi.mocked(agentChatApi.bootstrap).mockResolvedValueOnce(store.bootstrap!)
    vi.mocked(agentChatApi.list).mockResolvedValueOnce({ items: [recent], next_cursor: 'next-page' })
    vi.mocked(agentChatApi.active).mockResolvedValueOnce({ items: [] })
    vi.mocked(agentChatApi.get).mockResolvedValueOnce(target)
    await store.restore('old')
    expect(store.selected).toBe('old')
    expect(store.current.title).toBe('较早的目标')
    expect(agentChatApi.get).toHaveBeenCalledTimes(1)
    expect(agentChatApi.get).toHaveBeenCalledWith('i1', 'old', expect.any(AbortSignal))
    expect(store.listCursor).toBe('next-page')
    store.dispose()
  })

  it('即使没有并发快照请求也拒绝低修订快照', async () => {
    const store = workspace()
    store.chats.c1.revision = 5
    store.chats.c1.current_run_id = 'new'
    vi.mocked(agentChatApi.get).mockResolvedValueOnce({ ...store.chats.c1, revision: 4, current_run_id: 'old', messages: [] })
    await store.select('c1')
    expect(store.current.revision).toBe(5)
    expect(store.current.current_run_id).toBe('new')
    expect(agentChatApi.run).not.toHaveBeenCalled()
    store.dispose()
  })

  it('旧快照不能删除新一轮消息或恢复旧运行', async () => {
    const store = workspace()
    const old = deferred<AgentChat>()
    vi.mocked(agentChatApi.get).mockReturnValueOnce(old.promise)
    const refresh = store.select('c1')
    const run = { run_id: 'r2', chat_id: 'c1', instance_id: 'i1', message_id: 'a2', user_message_id: 'u2', status: 'running', answer: '新回答', reasoning: '', event_seq: 2, model: {} } as AgentRun
    const messages: AgentChat['messages'] = [{ message_id: 'a2', message_seq: 2, role: 'assistant', text: '', reasoning: '', run_id: 'r2', status: 'running' }]
    vi.mocked(agentChatApi.send).mockResolvedValueOnce(run)
    vi.mocked(agentChatApi.get).mockResolvedValueOnce({ ...store.chats.c1, revision: 3, current_run_id: 'r2', messages })
    vi.mocked(agentChatApi.run).mockResolvedValueOnce(run)
    await store.send()
    old.resolve({ chat_id: 'c1', title: '旧快照', revision: 2, updated_at: '', messages: [] })
    await refresh
    expect(store.current.current_run_id).toBe('r2')
    expect(store.current.messages?.[0]?.text).toBe('新回答')
    store.dispose()
  })
  it('旧列表不能删除请求期间新建的会话、草稿或选中项', async () => {
    const store = workspace()
    const old = deferred<{ items: AgentChat[] }>()
    vi.mocked(agentChatApi.bootstrap).mockResolvedValue(store.bootstrap!)
    vi.mocked(agentChatApi.list).mockReturnValue(old.promise)
    vi.mocked(agentChatApi.active).mockResolvedValue({ items: [] })
    const refresh = store.restore()
    await vi.waitFor(() => expect(agentChatApi.list).toHaveBeenCalled())
    const created = { chat_id: 'c2', title: '新会话', revision: 1, updated_at: '', messages: [] }
    vi.mocked(agentChatApi.create).mockResolvedValueOnce(created)
    await store.create(); store.drafts.c2 = '保留草稿'
    vi.mocked(agentChatApi.get).mockResolvedValueOnce(created)
    old.resolve({ items: [{ ...store.chats.c1 }] })
    await refresh
    expect(store.chats.c2).toBeDefined()
    expect(store.drafts.c2).toBe('保留草稿')
    expect(store.selected).toBe('c2')
    store.dispose()
  })
})
