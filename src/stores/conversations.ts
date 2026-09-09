import { defineStore } from 'pinia'
import { aiApi } from '@/api/chat'
import { normalizeConversation } from '@/api/chatProtocol'
import type { AcceptedRunRecord, Conversation, ConversationId, ConversationSummaryPage, HistoryMessage, MessageId, MessagePage, RunEvent, RunOperation, RunRecord, ClientRunState, UserMessage } from '@/types/ai'
import { toMessageId, toTurnId } from '@/types/ai'

function statusOf(message: HistoryMessage): 'partial' | 'complete' | 'stopped' | 'failed' {
  if (message.status === 'completed') return 'complete'
  if (message.status === 'stopped') return 'stopped'
  if (message.status === 'failed' || message.status === 'interrupted') return 'failed'
  return 'partial'
}

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
  state: () => ({ byId: {} as Record<string, Conversation>, order: [] as ConversationId[], cursor: null as string | null, searchQuery: '', currentId: null as ConversationId | null, loading: false, error: '' }),
  getters: {
    items: state => state.order.map(id => state.byId[id]).filter((item): item is Conversation => Boolean(item)),
    current: state => state.currentId ? state.byId[state.currentId] : undefined,
    ephemeral: state => Object.values(state.byId).filter(item => item.source === 'ephemeral')
  },
  actions: {
    merge(page: ConversationSummaryPage): void { for (const summary of page.items) { this.byId[summary.id] = normalizeConversation(summary, this.byId[summary.id]); if (!this.order.includes(summary.id)) this.order.push(summary.id) } this.cursor = page.next_cursor },
    async load(query?: string): Promise<void> { const queryValue = query ?? this.searchQuery; this.loading = true; this.error = ''; this.searchQuery = queryValue; try { this.merge(await aiApi.listConversations({ query: queryValue || undefined })) } catch (error) { this.error = error instanceof Error ? error.message : '历史加载失败' } finally { this.loading = false } },
    async create(): Promise<Conversation> { const summary = await aiApi.createConversation(); const conversation = normalizeConversation(summary); this.byId[conversation.id] = conversation; this.order = [conversation.id, ...this.order.filter(id => id !== conversation.id)]; this.currentId = conversation.id; return conversation },
    async hydrate(id: ConversationId): Promise<Conversation | undefined> { const conversation = this.byId[id]; if (!conversation) return undefined; if (conversation.source === 'server' && conversation.turns.length === 0) { const page = await aiApi.loadMessages(id); this.byId[id] = mergeMessagePage(conversation, page); return this.byId[id] } return conversation },
    async select(id: ConversationId): Promise<Conversation | undefined> { this.currentId = id; return this.hydrate(id) },
    async rename(id: ConversationId, title: string): Promise<void> { const old = this.byId[id]; if (!old) return; this.byId[id] = { ...old, title }; try { this.byId[id] = normalizeConversation(await aiApi.renameConversation(id, title, old.revision), this.byId[id]) } catch (error) { this.byId[id] = old; throw error } },
    async remove(id: ConversationId): Promise<void> { const old = this.byId[id]; delete this.byId[id]; this.order = this.order.filter(item => item !== id); if (this.currentId === id) this.currentId = this.order[0] ?? null; try { await aiApi.deleteConversation(id) } catch (error) { if (old) { this.byId[id] = old; this.order.push(id) } throw error } },
    async selectVersion(id: ConversationId, turnId: string, messageId: MessageId): Promise<void> { const conversation = this.byId[id]; if (!conversation) return; const result = await aiApi.selectVersion(id, turnId, messageId); this.byId[id] = { ...mergeMessagePage(conversation, { items: result.items, next_cursor: null }), revision: result.conversation_revision } },
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
    markRunActive(run: RunRecord): void { const conversation = this.byId[run.conversation_id]; if (conversation) conversation.active_run_id = run.run_id },
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
    applyRunEvent(event: RunEvent): void {
      const eventConversation = this.byId[event.conversation_id]
      const activeConversation = event.type === 'run.created' ? Object.values(this.byId).find(item => item.active_run_id === event.run_id) : undefined
      const conversation = activeConversation ?? eventConversation
      if (!conversation) return
      if (event.type === 'title.updated') {
        conversation.title = event.payload.title
        conversation.updated_at = event.emitted_at
        return
      }
      if (event.type !== 'run.created') return
      if (conversation.id !== event.conversation_id) {
        const oldConversationId = conversation.id
        delete this.byId[oldConversationId]
        conversation.id = event.conversation_id
        this.byId[event.conversation_id] = conversation
        this.order = this.order.map(id => id === oldConversationId ? event.conversation_id : id)
        if (this.currentId === oldConversationId) this.currentId = event.conversation_id
      }
      const exact = conversation.turns.find(turn => turn.id === event.payload.turn_id)
      const turn = exact ?? (conversation.active_run_id === event.run_id ? conversation.turns.at(-1) : undefined)
      if (!turn) return
      const oldTurnId = turn.id
      turn.id = event.payload.turn_id
      conversation.turn_ids = conversation.turn_ids.map(id => id === oldTurnId ? event.payload.turn_id : id)
      if (!conversation.turn_ids.includes(event.payload.turn_id)) conversation.turn_ids.push(event.payload.turn_id)
      const selected = turn.assistant_versions.find(version => version.id === turn.selected_assistant_id) ?? turn.assistant_versions[0]
      if (selected) selected.id = event.payload.assistant_message_id
      turn.selected_assistant_id = event.payload.assistant_message_id
    },
    syncRun(run: ClientRunState): void {
      const conversation = this.byId[run.conversationId]; const turn = conversation?.turns.find(item => item.id === run.turnId); const assistant = turn?.assistant_versions.find(item => item.id === run.assistantMessageId)
      if (!conversation || !turn || !assistant) return
      assistant.content = run.answer; assistant.reasoning = run.reasoning; assistant.status = run.state === 'completed' ? 'complete' : run.state === 'stopped' ? 'stopped' : run.state === 'failed' || run.state === 'interrupted' ? 'failed' : 'partial'
      if (run.terminalError?.code === 'RUN_OUTPUT_INCOMPLETE') assistant.finish_reason = 'max_output_tokens'
      if (['completed', 'stopped', 'failed', 'interrupted'].includes(run.state)) delete conversation.active_run_id
      conversation.updated_at = new Date().toISOString()
    },
    addEphemeral(conversation: Conversation): void { this.byId[conversation.id] = conversation; this.order.unshift(conversation.id); this.currentId = conversation.id },
    async importEphemeral(): Promise<void> { const page = await aiApi.importAnonymous(this.ephemeral); for (const id of this.ephemeral.map(item => item.id)) { delete this.byId[id]; this.order = this.order.filter(value => value !== id) } this.merge(page); this.currentId = page.items[0]?.id ?? this.currentId },
    discardEphemeral(): void { for (const conversation of this.ephemeral) { delete this.byId[conversation.id]; this.order = this.order.filter(id => id !== conversation.id) } if (this.currentId && !this.byId[this.currentId]) this.currentId = this.order[0] ?? null },
    clear(): void { this.byId = {}; this.order = []; this.cursor = null; this.currentId = null }
  }
})
