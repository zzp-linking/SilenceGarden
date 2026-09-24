/**
 * 会话列表与当前对话正文的 Pinia store。
 *
 * epoch 在 clear() 时递增：登出/切账号后，过期的 list/hydrate 回调必须丢弃。
 * attachRun / applyRunEvent / syncRun 把 Run 投影到 TurnViewModel，
 * 真正的流式缓冲仍在 chatRuns。
 */
import { defineStore } from 'pinia'
import { aiApi } from '@/api/chat'
import { normalizeConversation } from '@/api/chatProtocol'
import type { AcceptedRunRecord, Conversation, ConversationId, ConversationSummaryPage, HistoryMessage, MessageId, MessagePage, RunEvent, RunId, RunOperation, RunRecord, ClientRunState, UserMessage } from '@/features/ai/model'
import { toMessageId, toTurnId } from '@/features/ai/model'

/** 把历史接口的 status 映射到气泡用的四态。pending/streaming 都算 partial。 */
function statusOf(message: HistoryMessage): 'partial' | 'complete' | 'stopped' | 'failed' {
  if (message.status === 'completed') return 'complete'
  if (message.status === 'stopped') return 'stopped'
  if (message.status === 'failed' || message.status === 'interrupted') return 'failed'
  return 'partial'
}

/**
 * 把一页 HistoryMessage 折进 Conversation.turns。
 * 同一 turn_id 的 user/assistant 会合并；助手按 id 去重更新。
 * 排序优先用 turn_index，缺省则排到末尾。
 */
export function mergeMessagePage(conversation: Conversation, page: MessagePage): Conversation {
  const turns = new Map(conversation.turns.map(turn => [String(turn.id), { ...turn, assistant_versions: [...turn.assistant_versions] }]))
  for (const message of page.items) {
    if (!message.turn_id) continue
    const key = String(message.turn_id)
    const existing = turns.get(key) ?? { id: toTurnId(key), user: { id: toMessageId(`user-${key}`), role: 'user' as const, content: '', created_at: message.created_at ?? new Date().toISOString() }, assistant_versions: [] }
    if (message.role === 'user') {
      existing.user = { id: message.id, role: 'user', content: message.content, had_image: message.had_image, created_at: message.created_at ?? existing.user.created_at }
    } else {
      const version = { id: message.id, content: message.content, reasoning: message.reasoning_content, status: statusOf(message), ...(message.finish_reason ? { finish_reason: message.finish_reason } : {}), created_at: message.created_at ?? new Date().toISOString() }
      const index = existing.assistant_versions.findIndex(item => item.id === message.id)
      if (index >= 0) existing.assistant_versions[index] = version
      else existing.assistant_versions.push(version)
      existing.selected_assistant_id = message.id
    }
    turns.set(key, existing)
  }
  const ordered = [...turns.values()].sort((left, right) => {
    const leftIndex = page.items.find(item => item.turn_id === left.id)?.turn_index ?? Number.MAX_SAFE_INTEGER
    const rightIndex = page.items.find(item => item.turn_id === right.id)?.turn_index ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
  return { ...conversation, turns: ordered, turn_ids: ordered.map(turn => turn.id) }
}

export const useConversationsStore = defineStore('conversations', {
  state: () => ({ epoch: 0, byId: {} as Record<string, Conversation>, order: [] as ConversationId[], cursor: null as string | null, searchQuery: '', currentId: null as ConversationId | null, loading: false, error: '' }),
  getters: {
    items: state => state.order.map(id => state.byId[id]).filter((item): item is Conversation => Boolean(item)),
    current: state => state.currentId ? state.byId[state.currentId] : undefined,
    ephemeral: state => Object.values(state.byId).filter(item => item.source === 'ephemeral')
  },
  actions: {
    isCurrent(epoch: number): boolean { return epoch === this.epoch },
    /** 把摘要页合并进 byId/order；已有 turns 由 normalizeConversation 保留。 */
    merge(page: ConversationSummaryPage): void { for (const summary of page.items) { this.byId[summary.id] = normalizeConversation(summary, this.byId[summary.id]); if (!this.order.includes(summary.id)) this.order.push(summary.id) } this.cursor = page.next_cursor },
    /**
     * 拉取会话列表。query 为空时是最近对话，非空走搜索。
     * @param query 不传则沿用 searchQuery
     */
    async load(query?: string): Promise<void> {
      const epoch = this.epoch
      const queryValue = query ?? this.searchQuery
      this.loading = true
      this.error = ''
      this.searchQuery = queryValue
      try {
        const page = await aiApi.listConversations({ query: queryValue || undefined })
        if (!this.isCurrent(epoch)) return
        this.merge(page)
      } catch (error) {
        if (!this.isCurrent(epoch)) return
        this.error = error instanceof Error ? error.message : '历史加载失败'
      } finally {
        if (this.isCurrent(epoch)) this.loading = false
      }
    },
    /** 登录用户新建空对话并立刻选中。 */
    async create(): Promise<Conversation> {
      const epoch = this.epoch
      const summary = await aiApi.createConversation()
      const conversation = normalizeConversation(summary)
      if (!this.isCurrent(epoch)) return conversation
      this.byId[conversation.id] = conversation
      this.order = [conversation.id, ...this.order.filter(id => id !== conversation.id)]
      this.currentId = conversation.id
      return conversation
    },
    /**
     * 服务端对话且本地 turns 为空时拉取消息页。
     * ephemeral 或已经 hydrate 过的对话直接返回。
     */
    async hydrate(id: ConversationId): Promise<Conversation | undefined> {
      const epoch = this.epoch
      const conversation = this.byId[id]
      if (!conversation) return undefined
      if (conversation.source !== 'server' || conversation.turns.length !== 0) return conversation
      const page = await aiApi.loadMessages(id)
      if (!this.isCurrent(epoch) || !this.byId[id]) return this.byId[id]
      this.byId[id] = mergeMessagePage(conversation, page)
      return this.byId[id]
    },
    /** 选中对话并按需 hydrate。 */
    async select(id: ConversationId): Promise<Conversation | undefined> {
      if (!this.byId[id]) return undefined
      this.currentId = id
      return this.hydrate(id)
    },
    /** 乐观改标题，失败则回滚 old。 */
    async rename(id: ConversationId, title: string): Promise<void> {
      const epoch = this.epoch
      const old = this.byId[id]
      if (!old) return
      this.byId[id] = { ...old, title }
      try {
        const summary = await aiApi.renameConversation(id, title, old.revision)
        if (!this.isCurrent(epoch) || !this.byId[id]) return
        this.byId[id] = normalizeConversation(summary, this.byId[id])
      } catch (error) {
        if (this.isCurrent(epoch) && this.byId[id]) this.byId[id] = old
        throw error
      }
    },
    /** 乐观从列表移除，失败则把 old 插回（不保证原顺序）。 */
    async remove(id: ConversationId): Promise<void> {
      const epoch = this.epoch
      const old = this.byId[id]
      delete this.byId[id]
      this.order = this.order.filter(item => item !== id)
      if (this.currentId === id) this.currentId = this.order[0] ?? null
      try {
        await aiApi.deleteConversation(id)
      } catch (error) {
        if (old && this.isCurrent(epoch)) {
          this.byId[id] = old
          this.order.push(id)
        }
        throw error
      }
    },
    /** 切换当前展示的助手版本，并用返回的 items 刷新该 turn。 */
    async selectVersion(id: ConversationId, turnId: string, messageId: MessageId): Promise<void> {
      const epoch = this.epoch
      const conversation = this.byId[id]
      if (!conversation) return
      const result = await aiApi.selectVersion(id, turnId, messageId)
      if (!this.isCurrent(epoch) || !this.byId[id]) return
      this.byId[id] = { ...mergeMessagePage(conversation, { items: result.items, next_cursor: null }), revision: result.conversation_revision }
    },
    /** 匿名对话没有版本选择接口，只切换浏览器内当前展示的助手版本。 */
    selectLocalVersion(id: ConversationId, turnId: string, messageId: MessageId): void {
      const conversation = this.byId[id]
      const turn = conversation?.turns.find(item => item.id === turnId)
      if (!conversation || !turn || !turn.assistant_versions.some(version => version.id === messageId)) return
      turn.selected_assistant_id = messageId
      conversation.updated_at = new Date().toISOString()
    },
    /**
     * 在 createRun / 匿名占位成功后立刻插入气泡，不必等第一条 SSE。
     * regenerate 在已有 turn 上追加空的助手版本；send / fork 新建 turn。
     */
    attachRun(run: AcceptedRunRecord, content: string, hadImage = false, operation: RunOperation = 'send'): void {
      const stored = this.byId[run.conversation_id]
      const conversation: Conversation = stored
        ? { ...stored, turn_ids: Array.isArray(stored.turn_ids) ? [...stored.turn_ids] : [], turns: Array.isArray(stored.turns) ? [...stored.turns] : [] }
        : { id: run.conversation_id, title: content.slice(0, 24) || '未命名对话', source: 'server', updated_at: new Date().toISOString(), turn_ids: [], turns: [] }
      if (run.conversation_title) conversation.title = run.conversation_title
      const createdAt = new Date().toISOString()
      const assistant = { id: run.assistant_message_id, content: '', reasoning: '', status: 'partial' as const, created_at: createdAt }
      const existingIndex = operation === 'regenerate'
        ? conversation.turns.findIndex(turn => turn.id === run.turn_id || turn.user.id === run.user_message_id)
        : -1
      if (existingIndex >= 0) {
        const existing = conversation.turns[existingIndex]
        if (existing) {
          const versions = existing.assistant_versions.filter(version => version.id !== run.assistant_message_id)
          conversation.turns[existingIndex] = { ...existing, assistant_versions: [...versions, assistant], selected_assistant_id: run.assistant_message_id }
        }
      } else {
        const user: UserMessage = { id: run.user_message_id, role: 'user', content, had_image: hadImage, created_at: createdAt }
        if (!conversation.turn_ids.includes(run.turn_id)) conversation.turn_ids = [...conversation.turn_ids, run.turn_id]
        conversation.turns = [...conversation.turns, { id: run.turn_id, user, assistant_versions: [assistant], selected_assistant_id: run.assistant_message_id }]
      }
      conversation.active_run_id = run.run_id; conversation.revision = run.conversation_revision; conversation.updated_at = new Date().toISOString(); this.byId[conversation.id] = conversation
      if (!this.order.includes(conversation.id)) this.order.unshift(conversation.id)
      this.currentId = conversation.id
    },
    /** 刷新恢复：只标记 active_run_id，不改消息内容。 */
    markRunActive(run: RunRecord): void { const conversation = this.byId[run.conversation_id]; if (conversation) conversation.active_run_id = run.run_id },
    /**
     * 刷新时若发现正在 regenerate，补一个空的助手版本，避免气泡对不上 assistant_message_id。
     */
    attachRecoveredRun(run: RunRecord): void {
      const conversation = this.byId[run.conversation_id]
      if (!conversation || run.operation !== 'regenerate') return
      const turnIndex = conversation.turns.findIndex(turn => turn.id === run.turn_id)
      if (turnIndex < 0) return
      const turn = conversation.turns[turnIndex]
      if (!turn) return
      const existing = turn.assistant_versions.find(version => version.id === run.assistant_message_id)
      const assistant = existing ?? { id: run.assistant_message_id, content: '', reasoning: '', status: 'partial' as const, created_at: new Date().toISOString() }
      conversation.turns[turnIndex] = {
        ...turn,
        assistant_versions: existing ? [...turn.assistant_versions] : [...turn.assistant_versions, assistant],
        selected_assistant_id: run.assistant_message_id
      }
      conversation.active_run_id = run.run_id
    },
    /**
     * 处理与会话身份相关的 SSE：
     * - title.updated：改标题
     * - run.created：匿名占位 ID 换成服务端 conversation/turn/message id
     * @param placeholderRunId 匿名流本地占位 run_id，created 到来前用它找对话
     * @param localTurnId 匿名 regenerate 的目标 Turn；存在时保留本地 Turn ID
     */
    applyRunEvent(event: RunEvent, placeholderRunId?: RunId, localTurnId?: string): void {
      const eventConversation = this.byId[event.conversation_id]
      const activeConversation = event.type === 'run.created' ? Object.values(this.byId).find(item => item.active_run_id === event.run_id || (placeholderRunId !== undefined && item.active_run_id === placeholderRunId)) : undefined
      const conversation = activeConversation ?? eventConversation
      if (!conversation) return
      if (event.type === 'title.updated') {
        conversation.title = event.payload.title
        conversation.updated_at = event.emitted_at
        return
      }
      if (event.type !== 'run.created') return
	  const turnId = event.payload.turn_id
	  const assistantMessageId = event.payload.assistant_message_id
	  if (!turnId || !assistantMessageId) return
      if (conversation.id !== event.conversation_id) {
        const oldConversationId = conversation.id
        delete this.byId[oldConversationId]
        conversation.id = event.conversation_id
        this.byId[event.conversation_id] = conversation
        this.order = this.order.map(id => id === oldConversationId ? event.conversation_id : id)
        if (this.currentId === oldConversationId) this.currentId = event.conversation_id
      }
	  const exact = conversation.turns.find(turn => turn.id === (localTurnId ?? turnId))
      const turn = exact ?? (conversation.active_run_id === event.run_id || (placeholderRunId !== undefined && conversation.active_run_id === placeholderRunId) ? conversation.turns.at(-1) : undefined)
      if (!turn) return
      if (!localTurnId) {
        const oldTurnId = turn.id
	    turn.id = turnId
	    conversation.turn_ids = conversation.turn_ids.map(id => id === oldTurnId ? turnId : id)
	    if (!conversation.turn_ids.includes(turnId)) conversation.turn_ids.push(turnId)
      }
      const selected = turn.assistant_versions.find(version => version.id === turn.selected_assistant_id) ?? turn.assistant_versions[0]
	  if (selected) selected.id = assistantMessageId
	  turn.selected_assistant_id = assistantMessageId
      conversation.active_run_id = event.run_id
    },
    /**
     * 把 chatRuns 的缓冲投影到对应助手气泡。
     * 只在 conversation.active_run_id === 本 run 时才清除进行中标记，
     * 防止旧终态 Run 把新一轮的关联清掉。
     */
    syncRun(run: ClientRunState): void {
      const conversation = this.byId[run.conversationId]; const turn = conversation?.turns.find(item => item.id === run.turnId); const assistant = turn?.assistant_versions.find(item => item.id === run.assistantMessageId)
      if (!conversation || !turn || !assistant) return
      assistant.content = run.answer; assistant.reasoning = run.reasoning; assistant.status = run.state === 'completed' ? 'complete' : run.state === 'stopped' ? 'stopped' : run.state === 'failed' || run.state === 'interrupted' ? 'failed' : 'partial'
      if (run.terminalError?.code === 'RUN_OUTPUT_INCOMPLETE') assistant.finish_reason = 'max_output_tokens'
      // runs 是全量状态表，任何一次变化都会重新同步其中的旧运行。
      // 旧的终态运行不能清掉后来一轮的 active_run_id，否则新流仍在接收，页面却会失去 run 关联并显示“已中断”。
      if (['completed', 'stopped', 'failed', 'interrupted'].includes(run.state) && conversation.active_run_id === run.runId) {
        delete conversation.active_run_id
      }
      conversation.updated_at = new Date().toISOString()
    },
    /** 把匿名浏览器对话插入列表并选中。 */
    addEphemeral(conversation: Conversation): void { this.byId[conversation.id] = conversation; this.order.unshift(conversation.id); this.currentId = conversation.id },
    /** 登录后把所有 ephemeral 一次性导入服务端；失败时本地副本保留。 */
    async importEphemeral(): Promise<void> {
      const epoch = this.epoch
      const page = await aiApi.importAnonymous(this.ephemeral)
      if (!this.isCurrent(epoch)) return
      for (const id of this.ephemeral.map(item => item.id)) { delete this.byId[id]; this.order = this.order.filter(value => value !== id) }
      this.merge(page)
      this.currentId = page.items[0]?.id ?? this.currentId
    },
    /** 用户拒绝导入时丢掉全部 ephemeral。 */
    discardEphemeral(): void { for (const conversation of this.ephemeral) { delete this.byId[conversation.id]; this.order = this.order.filter(id => id !== conversation.id) } if (this.currentId && !this.byId[this.currentId]) this.currentId = this.order[0] ?? null },
    /** 递增 epoch 并清空，使进行中的异步 load 全部失效。 */
    clear(): void {
      this.epoch += 1
      this.byId = {}
      this.order = []
      this.cursor = null
      this.currentId = null
      this.searchQuery = ''
      this.loading = false
      this.error = ''
    }
  }
})
