import { computed, reactive, shallowRef, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { agentChatApi } from '@/api/agentChat'
import { V2HttpError } from '@/api/clientV2'
import { useUserStore } from '@/stores/user'
import { terminal, busy, streamFinished, type AgentBootstrap, type AgentChat, type AgentMessage, type AgentRun } from '@/features/agent/chat/model'
import { RunSubscription, type ConnectionState } from '@/features/agent/chat/subscriptions'
import { extendHistoryCoverage, type HistoryCoverageRange } from '@/features/agent/chat/historyCoverage'

/** 账号范围内的临时工作区，不持久化消息、草稿或幂等载荷。 */
export const useAgentChatStore = defineStore('agent-chat', () => {
  const bootstrap = shallowRef<AgentBootstrap | null>(null) // 当前进程空间及可用状态。
  const chats = reactive<Record<string, AgentChat>>({}) // 已加载完整快照与列表摘要的合并状态。
  const runs = reactive<Record<string, AgentRun>>({}) // 按运行标识保存状态，不依赖当前选中项。
  const drafts = reactive<Record<string, string>>({}) // 每个会话的未发送文本，仅保存在内存。
  const connections = reactive<Record<string, ConnectionState>>({}) // 网络状态与真实运行状态分别维护。
  const pending = reactive<Record<string, { key: string; text: string; thinking: boolean; download: boolean; exportFile: boolean }>>({}) // 保留原文本、模式、两类附件授权和幂等键。
  const sending = reactive<Record<string, boolean>>({}) // 防止界面重复点击，最终仍由服务端保证原子性。
  const selected = shallowRef('') // 仅控制视图选择；路由也可保留会话标识。
  const notice = shallowRef('') // 单一且适度播报的状态与错误提示区。
  const loading = shallowRef(false) // 工作区初始发现状态。
  const listCursor = shallowRef('') // 当前列表的下一页，历史总量不受内存临时会话数限制。
  const pageLoading = reactive<Record<string, boolean>>({}) // 每会话历史页加载状态。
  const preferenceSaving = reactive<Record<string, boolean>>({}) // 偏好确认前不接纳新的发送意图。
  const deleted = new Set<string>() // 当前账号已删除资源，迟到响应不得复活。
  const subscriptions = new Map<string, RunSubscription>() // 连接归工作区生命周期管理。
  const refreshTickets = new Map<string, number>() // 同会话只接收最近一次快照请求。
  const committedMessages = new WeakSet<AgentMessage>() // 只标记在服务器历史水位内实际读到的消息。
  const historyRanges = new Map<string, HistoryCoverageRange[]>() // 已查询的历史区间，不以消息序号连续性猜测隐藏消息。
  let epoch = 0 // 账号或工作区变化时使全部旧异步回调失效。
  let lifetime = new AbortController() // 销毁时取消尚未结束的发现和 POST 请求。
  const current = computed(() => chats[selected.value])
  const list = computed(() => Object.values(chats).sort((a, b) => b.updated_at.localeCompare(a.updated_at)))

  /** 释放浏览器资源并使旧回调失效；后端运行仍独立继续。 */
  function dispose(): void {
    epoch++; lifetime.abort(); lifetime = new AbortController()
    for (const sub of subscriptions.values()) sub.close()
    subscriptions.clear(); refreshTickets.clear(); historyRanges.clear()
    for (const values of [chats, runs, drafts, connections, pending, sending]) for (const key of Object.keys(values)) delete values[key]
    selected.value = ''; bootstrap.value = null; loading.value = false; notice.value = ''; listCursor.value = ''; deleted.clear()
    for (const key of Object.keys(pageLoading)) delete pageLoading[key]
    for (const key of Object.keys(preferenceSaving)) delete preferenceSaving[key]
  }
  watch(() => useUserStore().user?.id, () => dispose(), { flush: 'sync' })

  /** 提供安全用户反馈；世代变化时重新读取启动信息并清理旧临时状态。 */
  async function report(error: unknown): Promise<void> {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (error instanceof V2HttpError && error.apiError.code === 'AGENT_INSTANCE_CHANGED') { resetExecution(); await restore(); notice.value = '服务已重启，已重新读取持久历史'; return }
    notice.value = error instanceof Error ? error.message : '操作失败，请稍后重试'
  }

  /** 将真实运行状态同步到助手消息，并隔离未在当前页面展示的其他运行。 */
  function accept(run: AgentRun, syncCurrent = true): void {
    // 较慢返回的 REST 快照不能覆盖序号更新的连续流式输出。
    const previous = runs[run.run_id]
    if (deleted.has(run.chat_id)) return
    if (previous && previous.event_seq > run.event_seq && run.persistence_status !== 'saved') run = previous
    if (previous?.persistence_status === 'saved' && run.persistence_status !== 'saved') run = previous
    if (previous?.source === 'history' && previous.persistence_status === 'saved' && run.source !== 'history') run = previous
    runs[run.run_id] = run
    const chat = chats[run.chat_id]
    const message = chat?.messages?.find(message => message.message_id === run.message_id)
    // 工具结果提交不确定时，历史可恢复比内存更完整的来源。仅覆盖临时助手投影。
    if (!message || !committedMessages.has(toRaw(message))) {
      // 预分配助手 ID 不代表 PG 存在回答行。历史中断快照可移除临时占位。
      if (chat && run.source === 'history' && run.persistence_status === 'saved' && run.status === 'interrupted' && !run.answer && !run.reasoning && !run.sources?.length && !run.artifacts?.length && !run.plan) {
        chat.messages = chat.messages?.filter(message => message.message_id !== run.message_id)
        const input = chat.messages?.find(message => message.message_id === run.user_message_id)
        if (input) Object.assign(input, { status: 'interrupted', reason: run.reason })
      } else if (message) {
        Object.assign(message, { text: run.answer, reasoning: run.reasoning, status: run.status, reason: run.reason, sources: run.sources, artifacts: run.artifacts, plan: run.plan })
      }
    }
    if (chat && syncCurrent) {
      if (!busy(run)) { if (chat.current_run_id === run.run_id) chat.current_run_id = undefined }
      else if (!chat.current_run_id || chat.current_run_id === run.run_id) chat.current_run_id = run.run_id
    }
  }

  /** 按运行标识建立订阅；切换会话不会关闭连接。 */
  function attach(run: AgentRun): void {
    accept(run)
    if (streamFinished(run) || run.replay_available === false || subscriptions.has(run.run_id)) return
    const generation = epoch
    const sub = new RunSubscription(run, {
      update: next => { if (generation === epoch) accept(next) },
      connection: state => {
        if (generation !== epoch) return
        connections[run.run_id] = state
        if (state === 'closed' || state === 'failed') subscriptions.delete(run.run_id)
        if (state === 'closed') { if (selected.value === run.chat_id) notice.value = runs[run.run_id]?.status === 'interrupted' ? '服务已重启，本轮未提交输出不可恢复' : runs[run.run_id]?.persistence_status === 'failed' ? '历史保存失败，请重试保存' : '回答已保存'; void refreshChat(run.chat_id).catch(report) }
      },
      gone: code => {
        if (generation !== epoch) return
        subscriptions.delete(run.run_id); connections[run.run_id] = 'failed'
        if (code === 'AGENT_INSTANCE_CHANGED') { resetExecution(); void restore().then(() => { notice.value = '服务已重启，已重新读取持久历史' }).catch(report) }
        else notice.value = code === 'AUTH_REQUIRED' ? '登录已过期' : '临时运行已不可访问，请刷新会话列表'
      }
    })
    subscriptions.set(run.run_id, sub); connections[run.run_id] = 'reconnecting'; void sub.start()
  }

  /** 为已有页初始化查询覆盖范围；运行中的助手投影不扩展服务器水位。 */
  function knownHistory(id: string): HistoryCoverageRange[] {
    const known = historyRanges.get(id)
    if (known) return known
    const chat = chats[id]
    const messages = chat?.messages ?? []
    if (!messages.length) return []
    return [{ fromSeq: chat.next_cursor ?? 0, throughSeq: chat.watermark ?? messages.reduce((seq, message) => Math.max(seq, message.message_seq), 0) }]
  }

  /** 记录before之前的一页；before=0表示最新页，其上界取该页服务器水位。 */
  function rememberPage(id: string, before: number, next: number | undefined, watermark: number): number | undefined {
    const ranges = extendHistoryCoverage(knownHistory(id), { fromSeq: next ?? 0, throughSeq: before ? before - 1 : watermark })
    historyRanges.set(id, ranges)
    return ranges[ranges.length - 1].fromSeq || undefined
  }

  /** 跨异步等待固定工作区世代，防止旧账号响应写入新工作区。 */
  async function refreshChat(id: string): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch
    const ticket = (refreshTickets.get(id) ?? 0) + 1
    refreshTickets.set(id, ticket)
    const chat = await agentChatApi.get(bootstrap.value.instance_id, id, lifetime.signal)
    if (generation !== epoch || refreshTickets.get(id) !== ticket || deleted.has(id)) return
    // 接纳和终态会提升会话修订号，旧快照不能删除后续轮次的消息。
    if (chats[id] && chats[id].revision > chat.revision) return
    // 最新页也可能附带一条水位之外的临时助手投影。只把实际历史行视为已提交。
    const existing = chats[id]?.messages ?? []
    const merged = new Map(existing.map(m => [m.message_id, m]))
    for (const m of chat.messages ?? []) {
      const committed = chat.watermark !== undefined && m.message_seq <= chat.watermark
      if (committed) committedMessages.add(toRaw(m))
      const previous = merged.get(m.message_id)
      if (committed || !previous || !committedMessages.has(toRaw(previous))) merged.set(m.message_id, m)
    }
    const watermark = chat.watermark ?? (chat.messages ?? []).reduce((seq, message) => Math.max(seq, message.message_seq), 0)
    const cursor = rememberPage(id, 0, chat.next_cursor, watermark)
    chats[id] = { ...chat, messages: [...merged.values()].sort((a, b) => a.message_seq - b.message_seq), next_cursor: cursor }
    for (const run of Object.values(runs)) if (run.chat_id === id) accept(run, false)
    // 流式终态可能先于 REST 返回，清除快照中已经结束的当前运行。
    if (chat.current_run_id && runs[chat.current_run_id] && !busy(runs[chat.current_run_id])) { chats[id].current_run_id = undefined; chat.current_run_id = undefined }
    if (chat.current_run_id) {
      const run = await agentChatApi.run(bootstrap.value!.instance_id, chat.current_run_id, lifetime.signal)
      if (generation === epoch && refreshTickets.get(id) === ticket) attach(run)
    }
  }

  /** 新进程撤销旧连接和消息页缓存；持久会话身份、草稿及不确定请求仍保留。 */
  function resetExecution(): void {
    epoch++; lifetime.abort(); lifetime = new AbortController()
    for (const sub of subscriptions.values()) sub.close()
    subscriptions.clear(); refreshTickets.clear(); historyRanges.clear()
    for (const values of [runs, connections, sending, pageLoading, preferenceSaving]) for (const key of Object.keys(values)) delete values[key]
    for (const chat of Object.values(chats)) {
      // 旧页可能混有尚未提交的输出，必须重新向PG取事实，不能跨世代继续合并。
      chat.current_run_id = undefined
      chat.messages = undefined
      chat.next_cursor = undefined
      chat.watermark = undefined
    }
    bootstrap.value = null
  }

  /** 刷新发现全部活动运行，包括其他标签页及非当前会话创建的运行。 */
  async function restore(preferred = selected.value): Promise<void> {
    const generation = epoch; const selection = selected.value; loading.value = true
    try {
      const boot = await agentChatApi.bootstrap(lifetime.signal)
      if (generation !== epoch) return
      if (bootstrap.value && bootstrap.value.instance_id !== boot.instance_id) { resetExecution(); await restore(preferred); notice.value = '服务已重启，已重新读取持久历史'; return }
      bootstrap.value = boot
      // 仅清理发起列表请求时已知且未被替换的对象，保留请求期间新建的会话。
      const known = new Map(Object.entries(chats))
      const [summaries, active] = await Promise.all([agentChatApi.list(boot.instance_id, lifetime.signal), agentChatApi.active(boot.instance_id, lifetime.signal)])
      if (generation !== epoch) return
      const ids = new Set(summaries.items.map(c => c.chat_id))
      listCursor.value = summaries.next_cursor ?? ''
      for (const [id, original] of known) if (!summaries.next_cursor && !ids.has(id) && chats[id] === original) { delete chats[id]; delete drafts[id]; historyRanges.delete(id) }
      for (const c of summaries.items) {
        if (!deleted.has(c.chat_id) && (!chats[c.chat_id] || chats[c.chat_id].revision <= c.revision)) chats[c.chat_id] = { ...chats[c.chat_id], ...c }
      }
      for (const run of active.items) attach(run)
      let restoredPreferred = false // 已独立恢复的目标不再重复请求同一最新页。
      // 列表只含首屏摘要，URL中的旧会话必须独立按ID授权读取，不能直接换成最新会话。
      if (selected.value === selection && preferred && !chats[preferred] && !deleted.has(preferred)) {
        try { await refreshChat(preferred); restoredPreferred = !!chats[preferred] } catch (error) {
          if (!(error instanceof V2HttpError) || error.status !== 404) throw error
          notice.value = '目标会话不存在或不可访问'
        }
        if (generation !== epoch) return
      }
      if (selected.value === selection) selected.value = chats[preferred] ? preferred : list.value[0]?.chat_id ?? ''
      if (selected.value && (!restoredPreferred || selected.value !== preferred)) await refreshChat(selected.value)
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
    if (generation === epoch && !deleted.has(id)) chats[id] = { ...chats[id], ...c }
  }
  /** 仅在服务端确认删除后释放本地状态。 */
  async function remove(id: string): Promise<void> {
    if (!bootstrap.value) return
    const generation = epoch; await agentChatApi.remove(bootstrap.value.instance_id, id, lifetime.signal)
    if (generation !== epoch) return
    deleted.add(id); refreshTickets.delete(id)
    for (const run of Object.values(runs)) if (run.chat_id === id) { subscriptions.get(run.run_id)?.close(); subscriptions.delete(run.run_id); delete runs[run.run_id]; delete connections[run.run_id] }
    delete chats[id]; delete drafts[id]; delete pending[id]; historyRanges.delete(id)
    if (selected.value === id) selected.value = list.value[0]?.chat_id ?? ''
    if (selected.value) await refreshChat(selected.value)
  }
  /** 网络或 5xx 结果不确定时保留原请求标识；明确的新输入使用新键。 */
  async function send(download = false, exportFile = false): Promise<void> {
    const id = selected.value; const text = drafts[id]?.trim()
    if (!bootstrap.value || !text || sending[id] || preferenceSaving[id]) return
    if (pending[id] && pending[id].text !== text) throw new Error('上次发送结果未确认，请先恢复原输入并重试核对')
    pending[id] ??= { key: crypto.randomUUID(), text, thinking: !!chats[id]?.thinking_preference && !!bootstrap.value.model?.thinking_allowed, download, exportFile }; sending[id] = true
    const generation = epoch
    try {
      const request = pending[id]
      const args = [bootstrap.value.instance_id, id, text, request.key, lifetime.signal, request.thinking] as const
      const grants: [boolean?, boolean?] = request.exportFile ? [request.download, true] : request.download ? [true] : []
      const run = await agentChatApi.send(...args, ...grants)
      if (generation !== epoch) return
      delete pending[id]; if (drafts[id]?.trim() === text) drafts[id] = ''
      attach(run); await refreshChat(id); notice.value = ''
    } catch (error) {
      if (generation !== epoch) return
      // 世代失效只拒绝了旧连接，不能据此认定原key未落库；保留原文本/模式供新世代核对。
      if (error instanceof V2HttpError && error.status < 500 && error.apiError.code !== 'AGENT_INSTANCE_CHANGED') delete pending[id]
      throw error
    } finally { if (generation === epoch) sending[id] = false }
  }
  /** 偏好更新只影响下一次请求，不重写已接纳或历史消息。 */
  async function setThinking(thinking: boolean): Promise<void> {
    const id = selected.value; const chat = chats[id]
    if (!chat || pending[id] || preferenceSaving[id]) return
    const generation = epoch; preferenceSaving[id] = true
    try {
      const value = await agentChatApi.preference(chat, thinking, lifetime.signal)
      if (generation === epoch && !deleted.has(id)) chats[id] = { ...chats[id], ...value }
    } finally { if (generation === epoch) preferenceSaving[id] = false }
  }
  /** 更早页补齐历史和已提交的临时占位，保留已读回的最新历史。 */
  async function older(id: string): Promise<void> {
    const before = chats[id]?.next_cursor
    if (!before || pageLoading[id]) return
    const generation = epoch; pageLoading[id] = true
    try {
      const page = await agentChatApi.messages(id, before, lifetime.signal)
      if (generation !== epoch || deleted.has(id) || !chats[id]) return
      const all = new Map((chats[id].messages ?? []).map(m => [m.message_id, m]))
      for (const m of page.items) {
        if (m.message_seq >= before || m.message_seq > page.watermark) continue
        const previous = all.get(m.message_id)
        if (!previous || !committedMessages.has(toRaw(previous))) {
          committedMessages.add(toRaw(m))
          all.set(m.message_id, m)
        }
      }
      const cursor = rememberPage(id, before, page.next_cursor, page.watermark)
      chats[id].messages = [...all.values()].sort((a, b) => a.message_seq - b.message_seq); chats[id].next_cursor = cursor
    } finally { if (generation === epoch) pageLoading[id] = false }
  }
  /** 会话列表按服务端游标追加，独立于当前选中会话。 */
  async function moreChats(): Promise<void> {
    if (!bootstrap.value || !listCursor.value || loading.value) return
    const generation = epoch; loading.value = true
    try {
      const page = await agentChatApi.list(bootstrap.value.instance_id, lifetime.signal, listCursor.value)
      if (generation !== epoch) return
      for (const c of page.items) if (!deleted.has(c.chat_id) && (!chats[c.chat_id] || chats[c.chat_id].revision <= c.revision)) chats[c.chat_id] = { ...chats[c.chat_id], ...c }
      listCursor.value = page.next_cursor ?? ''
    } finally { if (generation === epoch) loading.value = false }
  }
  /** 只重试冻结结果落库，不再调用模型。 */
  async function save(id: string): Promise<void> {
    const generation = epoch; const run = await agentChatApi.save(id, lifetime.signal)
    if (generation === epoch && !deleted.has(run.chat_id)) { accept(run); await refreshChat(run.chat_id); notice.value = run.persistence_status === 'saved' ? '回答已保存' : '历史保存失败，请稍后重试' }
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
  return { bootstrap, chats, runs, drafts, connections, pending, sending, selected, notice, loading, current, list, listCursor, pageLoading, preferenceSaving, restore, select, create, rename, remove, send, stop, reconnect, dispose, report, setThinking, older, moreChats, save }
})
