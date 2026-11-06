import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAgentChatStore } from './chat'
import { agentChatApi } from '@/api/agentChat'
import { useUserStore } from '@/stores/user'
import type { AgentRun, AgentChat } from '@/features/agent/chat/model'

/** Capture subscription observers to exercise delayed off-screen events without a network model. */
const observers = vi.hoisted(() => new Map<string, { update: (run: AgentRun) => void }>())

vi.mock('@/api/agentChat', () => ({ agentChatApi: { send: vi.fn(), get: vi.fn(), run: vi.fn(), bootstrap: vi.fn(), list: vi.fn(), active: vi.fn(), create: vi.fn() } }))
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
  it('keeps the exact idempotency key after uncertain POST and clears draft only on accepted response', async () => {
    const store = workspace()
    vi.mocked(agentChatApi.send).mockRejectedValueOnce(new TypeError('offline'))
    await expect(store.send()).rejects.toThrow('offline')
    const key = store.pending.c1.key; expect(store.drafts.c1).toBe('hello')
    const accepted = { run_id: 'r1', chat_id: 'c1', instance_id: 'i1', message_id: 'a1', user_message_id: 'u1', status: 'running', answer: '', reasoning: '', event_seq: 1, model: {} } as AgentRun
    vi.mocked(agentChatApi.send).mockResolvedValue(accepted); vi.mocked(agentChatApi.get).mockResolvedValue(store.chats.c1); vi.mocked(agentChatApi.run).mockResolvedValue(accepted)
    await store.send(); expect(agentChatApi.send).toHaveBeenLastCalledWith('i1', 'c1', 'hello', key, expect.any(AbortSignal)); expect(store.drafts.c1).toBe(''); expect(store.runs.r1.run_id).toBe('r1'); store.dispose()
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
describe('会话刷新并发保护', () => {
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
