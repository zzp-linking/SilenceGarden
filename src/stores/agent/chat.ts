import { computed, reactive, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { agentChatApi } from '@/api/agentChat'
import { V2HttpError } from '@/api/clientV2'
import { useUserStore } from '@/stores/user'
import { terminal, type AgentBootstrap, type AgentChat, type AgentRun } from '@/features/agent/chat/model'
import { RunSubscription, type ConnectionState } from '@/features/agent/chat/subscriptions'

/** 账号范围内的临时工作区，不持久化消息、草稿或幂等载荷。 */
export const useAgentChatStore = defineStore('agent-chat', () => {
  const bootstrap = shallowRef<AgentBootstrap | null>(null) // 当前进程空间及可用状态。
  const chats = reactive<Record<string, AgentChat>>({}) // 已加载完整快照与列表摘要的合并状态。
  const runs = reactive<Record<string, AgentRun>>({}) // 按运行标识保存状态，不依赖当前选中项。
  const drafts = reactive<Record<string, string>>({}) // 每个会话的未发送文本，仅保存在内存。
  const connections = reactive<Record<string, ConnectionState>>({}) // 网络状态与真实运行状态分别维护。
  const pending = reactive<Record<string, { key: string; text: string }>>({}) // 保留结果不确定的接纳请求键。
  const sending = reactive<Record<string, boolean>>({}) // 防止界面重复点击，最终仍由服务端保证原子性。
  const selected = shallowRef('') // 仅控制视图选择；路由也可保留会话标识。
  const notice = shallowRef('') // 单一且适度播报的状态与错误提示区。
  const loading = shallowRef(false) // 工作区初始发现状态。
  const subscriptions = new Map<string, RunSubscription>() // 连接归工作区生命周期管理。
  const refreshTickets = new Map<string, number>() // 同会话只接收最近一次快照请求。
  let epoch = 0 // 账号或工作区变化时使全部旧异步回调失效。
  let lifetime = new AbortController() // 销毁时取消尚未结束的发现和 POST 请求。
  const current = computed(() => chats[selected.value])
  const list = computed(() => Object.values(chats).sort((a, b) => b.updated_at.localeCompare(a.updated_at)))

  /** 释放浏览器资源并使旧回调失效；后端运行仍独立继续。 */
  function dispose(): void {
    epoch++; lifetime.abort(); lifetime = new AbortController()
    for (const sub of subscriptions.values()) sub.close()
    subscriptions.clear(); refreshTickets.clear()
    for (const values of [chats, runs, drafts, connections, pending, sending]) for (const key of Object.keys(values)) delete values[key]
    selected.value = ''; bootstrap.value = null; loading.value = false; notice.value = ''
  }
  watch(() => useUserStore().user?.id, () => dispose(), { flush: 'sync' })

  /** 提供安全用户反馈；世代变化时重新读取启动信息并清理旧临时状态。 */
  async function report(error: unknown): Promise<void> {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (error instanceof V2HttpError && error.apiError.code === 'AGENT_INSTANCE_CHANGED') { dispose(); await restore(); notice.value = '服务已重启，临时会话已清空'; return }
    notice.value = error instanceof Error ? error.message : '操作失败，请稍后重试'
  }

  /** 将真实运行状态同步到助手消息，并隔离未在当前页面展示的其他运行。 */
  function accept(run: AgentRun, syncCurrent = true): void {
    // 较慢返回的 REST 快照不能覆盖序号更新的连续流式输出。
    const previous = runs[run.run_id]
    if (previous && previous.event_seq > run.event_seq) run = previous
    runs[run.run_id] = run
    const chat = chats[run.chat_id]
    const message = chat?.messages?.find(m => m.message_id === run.message_id)
    if (message) Object.assign(message, { text: run.answer, reasoning: run.reasoning, status: run.status, reason: run.reason })
    if (chat && syncCurrent) {
      if (terminal(run.status)) { if (chat.current_run_id === run.run_id) chat.current_run_id = undefined }
      else if (!chat.current_run_id || chat.current_run_id === run.run_id) chat.current_run_id = run.run_id
    }
  }

  /** 按运行标识建立订阅；切换会话不会关闭连接。 */
  function attach(run: AgentRun): void {
    accept(run)
    if (terminal(run.status) || subscriptions.has(run.run_id)) return
    const generation = epoch
    const sub = new RunSubscription(run, {
      update: next => { if (generation === epoch) accept(next) },
      connection: state => {
        if (generation !== epoch) return
        connections[run.run_id] = state
        if (state === 'closed' || state === 'failed') subscriptions.delete(run.run_id)
        if (state === 'closed') { if (selected.value === run.chat_id) notice.value = '回答结束'; void refreshChat(run.chat_id).catch(report) }
      },
      gone: code => {
        if (generation !== epoch) return
        subscriptions.delete(run.run_id); connections[run.run_id] = 'failed'
        if (code === 'AGENT_INSTANCE_CHANGED') { dispose(); void restore().then(() => { notice.value = '服务已重启，临时会话已清空' }).catch(report) }
        else notice.value = code === 'AUTH_REQUIRED' ? '登录已过期' : '临时运行已不可访问，请刷新会话列表'
      }
    })
    subscriptions.set(run.run_id, sub); connections[run.run_id] = 'reconnecting'; void sub.start()
  }

  /** 跨异步等待固定工作区世代，防止旧账号响应写入新工作区。 */
  async function refreshChat(id: string): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch
    const ticket = (refreshTickets.get(id) ?? 0) + 1
    refreshTickets.set(id, ticket)
    const chat = await agentChatApi.get(bootstrap.value.instance_id, id, lifetime.signal)
    if (generation !== epoch || refreshTickets.get(id) !== ticket) return
    // 接纳和终态会提升会话修订号，旧快照不能删除后续轮次的消息。
    if (chats[id] && chats[id].revision > chat.revision) return
    chats[id] = chat
    for (const run of Object.values(runs)) if (run.chat_id === id) accept(run, false)
    // 流式终态可能先于 REST 返回，清除快照中已经结束的当前运行。
    if (chat.current_run_id && runs[chat.current_run_id] && terminal(runs[chat.current_run_id].status)) chat.current_run_id = undefined
    if (chat.current_run_id) {
      const run = await agentChatApi.run(bootstrap.value!.instance_id, chat.current_run_id, lifetime.signal)
      if (generation === epoch && refreshTickets.get(id) === ticket) attach(run)
    }
  }

  /** 刷新发现全部活动运行，包括其他标签页及非当前会话创建的运行。 */
  async function restore(preferred = selected.value): Promise<void> {
    const generation = epoch; const selection = selected.value; loading.value = true
    try {
      const boot = await agentChatApi.bootstrap(lifetime.signal)
      if (generation !== epoch) return
      if (bootstrap.value && bootstrap.value.instance_id !== boot.instance_id) { dispose(); await restore(); notice.value = '服务已重启，临时会话已清空'; return }
      bootstrap.value = boot
      // 仅清理发起列表请求时已知且未被替换的对象，保留请求期间新建的会话。
      const known = new Map(Object.entries(chats))
      const [summaries, active] = await Promise.all([agentChatApi.list(boot.instance_id, lifetime.signal), agentChatApi.active(boot.instance_id, lifetime.signal)])
      if (generation !== epoch) return
      const ids = new Set(summaries.items.map(c => c.chat_id))
      for (const [id, original] of known) if (!ids.has(id) && chats[id] === original) { delete chats[id]; delete drafts[id] }
      for (const c of summaries.items) {
        if (!chats[c.chat_id] || chats[c.chat_id].revision <= c.revision) chats[c.chat_id] = { ...chats[c.chat_id], ...c }
      }
      for (const run of active.items) attach(run)
      if (selected.value === selection) selected.value = chats[preferred] ? preferred : list.value[0]?.chat_id ?? ''
      if (selected.value) await refreshChat(selected.value)
    } finally { if (generation === epoch) loading.value = false }
  }

  /** 打开单个会话快照，不改变其他运行的订阅。 */
  async function select(id: string): Promise<void> { selected.value = id; notice.value = ''; await refreshChat(id) }
  /** 新会话归服务端管理，不携带旧会话上下文。 */
  async function create(): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch; const c = await agentChatApi.create(bootstrap.value.instance_id, lifetime.signal)
    if (generation !== epoch) return
    chats[c.chat_id] = c; selected.value = c.chat_id; notice.value = ''
  }
  /** 重命名使用当前快照修订号，发生冲突时保留输入。 */
  async function rename(id: string, title: string): Promise<void> {
    if (!bootstrap.value || !chats[id]) return
    const generation = epoch; const c = await agentChatApi.rename(bootstrap.value.instance_id, chats[id], title, lifetime.signal)
    if (generation === epoch) chats[id] = { ...chats[id], ...c }
  }
  /** 仅在服务端确认删除后释放本地状态。 */
  async function remove(id: string): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch; await agentChatApi.remove(bootstrap.value.instance_id, id, lifetime.signal)
    if (generation !== epoch) return
    for (const run of Object.values(runs)) if (run.chat_id === id) { subscriptions.get(run.run_id)?.close(); subscriptions.delete(run.run_id); delete runs[run.run_id]; delete connections[run.run_id] }
    delete chats[id]; delete drafts[id]; delete pending[id]
    if (selected.value === id) selected.value = list.value[0]?.chat_id ?? ''
    if (selected.value) await refreshChat(selected.value)
  }
  /** 网络或 5xx 结果不确定时保留原请求标识；明确的新输入使用新键。 */
  async function send(): Promise<void> {
    const id = selected.value; const text = drafts[id]?.trim()
    if (!bootstrap.value || !text || sending[id]) return
    if (pending[id] && pending[id].text !== text) throw new Error('上次发送结果未确认，请先恢复原输入并重试核对')
    pending[id] ??= { key: crypto.randomUUID(), text }; sending[id] = true
    const generation = epoch
    try {
      const run = await agentChatApi.send(bootstrap.value.instance_id, id, text, pending[id].key, lifetime.signal)
      if (generation !== epoch) return
      delete pending[id]; if (drafts[id]?.trim() === text) drafts[id] = ''
      attach(run); await refreshChat(id); notice.value = ''
    } catch (error) {
      if (generation !== epoch) return
      if (error instanceof V2HttpError && error.status < 500) delete pending[id]
      throw error
    } finally { if (generation === epoch) sending[id] = false }
  }
  /** 停止只提交意图；执行器实际退出前，返回的真实快照仍为停止中。 */
  async function stop(id: string): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch; const run = await agentChatApi.stop(bootstrap.value.instance_id, id, lifetime.signal)
    if (generation === epoch) { accept(run); notice.value = terminal(run.status) ? '回答已结束' : '' }
  }
  /** 显式重试只恢复订阅，不重新生成回答。 */
  async function reconnect(id: string): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch; const run = await agentChatApi.run(bootstrap.value.instance_id, id, lifetime.signal)
    if (generation === epoch) { subscriptions.get(id)?.close(); subscriptions.delete(id); attach(run) }
  }
  return { bootstrap, chats, runs, drafts, connections, pending, sending, selected, notice, loading, current, list, restore, select, create, rename, remove, send, stop, reconnect, dispose, report }
})
