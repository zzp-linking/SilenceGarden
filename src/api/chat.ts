/**
 * 静语 HTTP / SSE 客户端。
 *
 * - HttpAiApi：生产实现，路径相对 `/api`（由 clientV2 拼前缀）。
 * - MockAiApi：单测与 `VITE_AI_MOCK=true` 的本地假数据。
 * - 所有 JSON 响应都先经 chatProtocol 校验，再提升为 branded 类型。
 */
import { clientV2 } from '@/api/clientV2'
import {
  parseBootstrapData,
  parseAcceptedRunRecord,
  parseConversationSummary,
  parseConversationSummaryPage,
  parseMessagePage,
  parseVersionSelectionResult,
  parseRunPage,
  parseRunRecord
} from '@/api/chatProtocol'
import {
  toConversationId, toMessageId, toRunId, toTurnId,
  type AnonymousStreamRequest, type ApiError, type BootstrapData,
  type AcceptedRunRecord, type Conversation, type ConversationId, type ConversationSummary, type ConversationSummaryPage, type CreateRunRequest,
  type HistoryMessage, type MessageId, type MessagePage, type RunEvent, type RunId, type RunRecord, type UserMessage, type VersionSelectionResult
} from '@/features/ai/model'

/** 创建 Run 的请求。有 image 时走 multipart，否则走 JSON。 */
export interface CreateRunInput extends CreateRunRequest {
  /** 本轮附图的原始 Blob；服务端不持久化原图，只用于当次生成。 */
  image?: Blob
}

/** 静语对话模块对页面暴露的全部网络能力。 */
export interface AiApi {
  /** 读取服务开关、输入上限、建议提问和剩余额度。 */
  bootstrap(): Promise<BootstrapData>
  /**
   * 分页列出当前用户的对话摘要。
   * @param options.cursor 上一页返回的 next_cursor
   * @param options.query 标题/正文搜索词，空则返回最近列表
   * @param options.limit 页大小，服务端有上限
   */
  listConversations(options?: { cursor?: string; query?: string; limit?: number }): Promise<ConversationSummaryPage>
  /** 新建空对话（登录用户）。 */
  createConversation(): Promise<ConversationSummary>
  /**
   * 拉取对话消息页并拼成 HistoryMessage。
   * @param conversationId 对话公开 ID
   * @param cursor 历史向后翻页游标
   */
  loadMessages(conversationId: ConversationId, cursor?: string): Promise<MessagePage>
  /**
   * 重命名。revision 用于 CAS，缺省时服务端按无版本冲突处理。
   */
  renameConversation(conversationId: ConversationId, title: string, revision?: number): Promise<ConversationSummary>
  deleteConversation(conversationId: ConversationId): Promise<void>
  /**
   * 把 turn 的当前助手版本切到 messageId，并返回该版本快照与新的 revision。
   */
  selectVersion(conversationId: ConversationId, turnId: string, messageId: MessageId): Promise<VersionSelectionResult>
  /** 登录用户创建一次生成任务，返回可订阅的 AcceptedRunRecord。 */
  createRun(input: CreateRunInput): Promise<AcceptedRunRecord>
  /** 刷新恢复：列出当前用户所有未终态 Run。 */
  activeRuns(): Promise<RunRecord[]>
  /** 用 Mongo 权威状态校正本地乐观停止或 Redis 过期。 */
  getRun(runId: RunId): Promise<RunRecord>
  /** 请求停止。SSE 应继续开着，直到收到 run.stopped。 */
  cancelRun(runId: RunId): Promise<void>
  /**
   * 订阅登录用户的可重放 SSE。
   * @param after 已确认的最大序号，服务端从此之后重放
   * @param signal 取消订阅
   * @param onOpen 响应头到达、流真正打开时回调
   */
  subscribeRun(runId: RunId, after: number, signal: AbortSignal, onOpen?: () => void): AsyncIterable<RunEvent>
  /**
   * 匿名一次性流：请求与生成同生命周期，断线不可重放。
   * @param image 可选附图
   */
  anonymousStream(input: AnonymousStreamRequest, image: Blob | undefined, signal: AbortSignal): AsyncIterable<RunEvent>
  /** 登录后把浏览器里的 ephemeral 对话导入为服务端对话（只导文字）。 */
  importAnonymous(conversations: Conversation[]): Promise<ConversationSummaryPage>
}

/** Mock 与匿名占位用的 UUID；优先 crypto.randomUUID。 */
function createId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function now(): string { return new Date().toISOString() }
/** 可被 AbortSignal 打断的延迟，供 Mock 流控速。 */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return }
    const onAbort = (): void => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); resolve() }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** 构造一帧 Mock SSE 事件。T 保证 payload 与 type 对齐。 */
function event<T extends RunEvent['type']>(runId: RunId, conversationId: ConversationId, seq: number, type: T, payload: Extract<RunEvent, { type: T }>['payload']): Extract<RunEvent, { type: T }> {
  return { v: 1, seq, type, run_id: runId, conversation_id: conversationId, emitted_at: now(), payload } as Extract<RunEvent, { type: T }>
}

/** 内存里新建空对话，仅 Mock / 测试使用。 */
function newConversation(source: 'ephemeral' | 'server' = 'server', title = '未命名对话'): Conversation {
  return { id: toConversationId(createId()), title, source, updated_at: now(), turn_ids: [], turns: [] }
}

/** 把页面模型展平为 HistoryMessage 页，供 Mock loadMessages / selectVersion。 */
function messagePage(conversation: Conversation): MessagePage {
  const items: HistoryMessage[] = []
  for (const turn of conversation.turns) {
    items.push({ id: turn.user.id, role: 'user', content: turn.user.content, reasoning_content: '', status: 'completed', finish_reason: null, had_image: turn.user.had_image, turn_id: turn.id, turn_index: conversation.turns.indexOf(turn), version: 1, created_at: turn.user.created_at })
    const selected = turn.assistant_versions.find(version => version.id === turn.selected_assistant_id) ?? turn.assistant_versions[0]
    if (selected) items.push({ id: selected.id, role: 'assistant', content: selected.content, reasoning_content: selected.reasoning, status: selected.status === 'complete' ? 'completed' : selected.status === 'partial' ? 'streaming' : 'failed', finish_reason: selected.finish_reason ?? null, turn_id: turn.id, turn_index: conversation.turns.indexOf(turn), version: 1, created_at: selected.created_at })
  }
  return { items, next_cursor: null }
}

function error(code: string, message: string, retryable = false): ApiError {
  return { code, message, retryable }
}

/** 生产环境实现：所有路径相对 `/api`，SSE 用 requestRaw 拿原始 ReadableStream。 */
export class HttpAiApi implements AiApi {
  bootstrap(): Promise<BootstrapData> { return clientV2.request<unknown>('/ai/bootstrap').then(parseBootstrapData) }
  listConversations(options: { cursor?: string; query?: string; limit?: number } = {}): Promise<ConversationSummaryPage> {
    const params = new URLSearchParams()
    if (options.cursor) params.set('cursor', options.cursor)
    if (options.query) params.set('q', options.query)
    if (options.limit) params.set('limit', String(options.limit))
    return clientV2.request<unknown>(`/ai/conversations${params.size ? `?${params.toString()}` : ''}`).then(parseConversationSummaryPage)
  }
  createConversation(): Promise<ConversationSummary> { return clientV2.request<unknown>('/ai/conversations', { method: 'POST' }).then(value => parseConversationSummary(value)) }
  loadMessages(conversationId: ConversationId, cursor?: string): Promise<MessagePage> { return clientV2.request<unknown>(`/ai/conversations/${conversationId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`).then(parseMessagePage) }
  renameConversation(conversationId: ConversationId, title: string, revision?: number): Promise<ConversationSummary> { return clientV2.request<unknown>(`/ai/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify(revision === undefined ? { title } : { title, revision }) }).then(value => parseConversationSummary(value)) }
  async deleteConversation(conversationId: ConversationId): Promise<void> { await clientV2.request(`/ai/conversations/${conversationId}`, { method: 'DELETE' }) }
  selectVersion(conversationId: ConversationId, turnId: string, messageId: MessageId): Promise<VersionSelectionResult> { return clientV2.request<unknown>(`/ai/conversations/${conversationId}/turns/${turnId}`, { method: 'PATCH', body: JSON.stringify({ assistant_message_id: messageId }) }).then(parseVersionSelectionResult) }
  createRun(input: CreateRunInput): Promise<AcceptedRunRecord> {
    // 附图必须走 multipart：JSON 无法携带二进制，且 metadata 与 image 分字段避免把 Blob 序列化进 JSON。
    if (input.image) {
      const { image: _image, ...metadata } = input
      const form = new FormData()
      form.append('metadata', JSON.stringify(metadata))
      form.append('image', input.image)
      return clientV2.request<unknown>('/ai/runs', { method: 'POST', body: form }).then(value => parseAcceptedRunRecord(value))
    }
    const { image: _image, ...body } = input
    return clientV2.request<unknown>('/ai/runs', { method: 'POST', body: JSON.stringify(body) }).then(value => parseAcceptedRunRecord(value))
  }
  activeRuns(): Promise<RunRecord[]> { return clientV2.request<unknown>('/ai/runs/active').then(parseRunPage) }
  getRun(runId: RunId): Promise<RunRecord> { return clientV2.request<unknown>(`/ai/runs/${runId}`).then(value => parseRunRecord(value)) }
  async cancelRun(runId: RunId): Promise<void> { await clientV2.request(`/ai/runs/${runId}/cancel`, { method: 'POST' }) }
  async *subscribeRun(runId: RunId, after: number, signal: AbortSignal, onOpen?: () => void): AsyncIterable<RunEvent> {
    const response = await clientV2.requestRaw(`/ai/runs/${runId}/events?after=${after}`, { headers: { Accept: 'text/event-stream' }, signal })
    onOpen?.()
    if (!response.body) return
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const { createSseParser } = await import('@/features/ai/transport/sseParser')
    const parser = createSseParser()
    try {
      while (!signal.aborted) {
        const chunk = await reader.read()
        if (chunk.done) break
        for (const next of parser.push(decoder.decode(chunk.value, { stream: true }))) yield next
      }
      for (const next of parser.flush()) yield next
    } finally {
      // 消费方因序号错误、页面卸载或主动停止而退出时，明确关闭响应体。
      // 仅 AbortController 并不能保证所有浏览器立刻取消一个已经打开的响应流。
      await reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  }
  async *anonymousStream(input: AnonymousStreamRequest, image: Blob | undefined, signal: AbortSignal): AsyncIterable<RunEvent> {
    const body = image ? (() => { const form = new FormData(); form.append('metadata', JSON.stringify(input)); form.append('image', image); return form })() : JSON.stringify(input)
    const response = await clientV2.requestRaw('/ai/anonymous/stream', { method: 'POST', body, headers: image ? { Accept: 'text/event-stream' } : { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, signal }, false)
    if (!response.body) return
    const reader = response.body.getReader(); const decoder = new TextDecoder(); const { createSseParser } = await import('@/features/ai/transport/sseParser'); const parser = createSseParser()
    try {
      while (!signal.aborted) { const chunk = await reader.read(); if (chunk.done) break; for (const next of parser.push(decoder.decode(chunk.value, { stream: true }))) yield next }
      for (const next of parser.flush()) yield next
    } finally {
      // 匿名生成与 HTTP 请求同生命周期，退出消费必须同步取消底层网络读取。
      await reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  }
  importAnonymous(conversations: Conversation[]): Promise<ConversationSummaryPage> { return clientV2.request<unknown>('/ai/conversations/import', { method: 'POST', body: JSON.stringify({ conversations }) }).then(parseConversationSummaryPage) }
}

/**
 * 进程内假后端。事件按固定脚本吐出，cancel 会追加 run.stopped。
 * 不模拟审核、配额与 Redis 重放缺口。
 */
export class MockAiApi implements AiApi {
  readonly conversations = new Map<ConversationId, Conversation>()
  readonly runs = new Map<RunId, RunRecord>()
  readonly runEvents = new Map<RunId, RunEvent[]>()
  private readonly pending = new Set<RunId>()
  private readonly bootstrapData: BootstrapData = {
    service: { enabled: true, maintenance_message: '静语正在休息，历史仍可查看。' },
    limits: { max_input_chars: 12000, max_output_tokens: 2048, max_image_bytes: 8 * 1024 * 1024, max_image_pixels: 16_000_000 },
    suggested_prompts: ['解释一个我最近遇到的概念', '帮我把一个想法写成提纲', '一起推敲一段文字', '看看这张图片里有什么'],
    identity: { kind: 'anonymous', rounds_remaining: 5, budget_remaining_micro_cny: 300_000 }
  }

  async bootstrap(): Promise<BootstrapData> { return structuredClone(this.bootstrapData) }
  async listConversations(options: { cursor?: string; query?: string; limit?: number } = {}): Promise<ConversationSummaryPage> {
    const query = options.query?.trim().toLowerCase() ?? ''
    const items = [...this.conversations.values()].filter(item => !query || item.title.toLowerCase().includes(query) || item.turns.some(turn => turn.user.content.toLowerCase().includes(query))).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    const limit = Math.min(options.limit ?? 30, 50)
    return { items: items.slice(0, limit).map(item => structuredClone(item)), next_cursor: items.length > limit ? String(limit) : null }
  }
  async createConversation(): Promise<Conversation> { const conversation = newConversation(); this.conversations.set(conversation.id, conversation); return structuredClone(conversation) }
  async loadMessages(conversationId: ConversationId): Promise<MessagePage> { return messagePage(this.getConversation(conversationId)) }
  async renameConversation(conversationId: ConversationId, title: string, _revision?: number): Promise<Conversation> { const conversation = this.getConversation(conversationId); conversation.title = title.trim().slice(0, 80) || '未命名对话'; conversation.updated_at = now(); return structuredClone(conversation) }
  async deleteConversation(conversationId: ConversationId): Promise<void> { this.conversations.delete(conversationId) }
  async selectVersion(conversationId: ConversationId, turnId: string, messageId: MessageId): Promise<VersionSelectionResult> { const conversation = this.getConversation(conversationId); const turn = conversation.turns.find(item => item.id === turnId); if (!turn || !turn.assistant_versions.some(version => version.id === messageId)) throw new Error('version not found'); turn.selected_assistant_id = messageId; conversation.revision = (conversation.revision ?? 0) + 1; return { items: messagePage(conversation).items.filter(item => item.id === messageId), conversation_revision: conversation.revision, turn_revision: 1, selected_assistant_id: messageId } }
  async createRun(input: CreateRunInput): Promise<AcceptedRunRecord> {
    const conversation = input.conversation_id ? this.getConversation(input.conversation_id) : await this.createConversation()
    const content = input.content?.trim() ?? '请从这张图片开始说说你的观察。'
    const user: UserMessage = { id: toMessageId(createId()), role: 'user', content, had_image: Boolean(input.image), created_at: now() }
    const sourceTurn = input.operation === 'regenerate' ? conversation.turns.find(turn => turn.user.id === input.source_message_id) : undefined
    const turnId = sourceTurn?.id ?? toTurnId(createId()); const assistantId = toMessageId(createId()); const runId = toRunId(createId())
    const persistedUser = sourceTurn?.user ?? user
    if (sourceTurn) { sourceTurn.assistant_versions.push({ id: assistantId, content: '', reasoning: '', status: 'partial', created_at: now() }); sourceTurn.selected_assistant_id = assistantId }
    else { conversation.turn_ids.push(turnId); conversation.turns.push({ id: turnId, user, assistant_versions: [{ id: assistantId, content: '', reasoning: '', status: 'partial', created_at: now() }], selected_assistant_id: assistantId }) }
    conversation.updated_at = now(); conversation.active_run_id = runId
    const record: AcceptedRunRecord = { run_id: runId, operation: input.operation, conversation_id: conversation.id, turn_id: turnId, user_message_id: persistedUser.id, assistant_message_id: assistantId, conversation_revision: conversation.revision ?? 0, state: 'reserved', events_url: `/home/api/ai/runs/${runId}/events`, reservation: { reserved_micro_cny: 1200, price_version: 1 } }
    this.runs.set(runId, record); this.pending.add(runId)
    const answer = `这是一个 mock 回答：${content}`
    const events: RunEvent[] = [event(runId, conversation.id, 1, 'run.created', { state: 'reserved', turn_id: turnId, assistant_message_id: assistantId }), event(runId, conversation.id, 2, 'run.status', { state: 'running' }), event(runId, conversation.id, 3, 'reasoning.delta', { delta: '我先把问题拆开来看。' }), event(runId, conversation.id, 4, 'answer.delta', { delta: answer }), event(runId, conversation.id, 5, 'usage.final', { input_cache_hit_tokens: 0, input_cache_miss_tokens: content.length, output_tokens: answer.length, reasoning_tokens: 8, actual_micro_cny: 800, usage_missing: false }), event(runId, conversation.id, 6, 'title.updated', { title: content.slice(0, 24) }), event(runId, conversation.id, 7, 'run.completed', { finished_at: now(), finish_reason: 'stop', partial: false })]
    this.runEvents.set(runId, events)
    return structuredClone(record)
  }
  async activeRuns(): Promise<RunRecord[]> { return [...this.runs.values()].filter(run => !['completed', 'stopped', 'failed', 'interrupted'].includes(run.state)).map(run => structuredClone(run)) }
  async getRun(runId: RunId): Promise<RunRecord> { const run = this.runs.get(runId); if (!run) throw new Error('run not found'); return structuredClone(run) }
  async cancelRun(runId: RunId): Promise<void> { const run = this.runs.get(runId); if (!run) throw new Error('run not found'); run.state = 'stopped'; this.pending.delete(runId); const events = this.runEvents.get(runId) ?? []; if (!events.some(item => item.type === 'run.stopped')) events.push(event(runId, run.conversation_id, events.length + 1, 'run.stopped', { finished_at: now(), partial: true })) }
  async *subscribeRun(runId: RunId, after: number, signal: AbortSignal, onOpen?: () => void): AsyncIterable<RunEvent> { onOpen?.(); const events = this.runEvents.get(runId) ?? []; for (const item of events.filter(item => item.seq > after)) { await wait(18, signal); if (signal.aborted) return; yield item; this.applyMockEvent(item) } this.pending.delete(runId) }
  async *anonymousStream(input: AnonymousStreamRequest, _image: Blob | undefined, signal: AbortSignal): AsyncIterable<RunEvent> { const runId = toRunId(input.client_request_id); const conversationId = input.conversation_id ?? toConversationId(createId()); const turnId = toTurnId(createId()); const assistantId = toMessageId(createId()); const answer = `这是一个匿名 mock 回答：${input.content}`; const events: RunEvent[] = [event(runId, conversationId, 1, 'run.created', { state: 'reserved', turn_id: turnId, assistant_message_id: assistantId }), event(runId, conversationId, 2, 'run.status', { state: 'running' }), event(runId, conversationId, 3, 'answer.delta', { delta: answer }), event(runId, conversationId, 4, 'run.completed', { finished_at: now(), finish_reason: 'stop', partial: false })]; for (const item of events) { await wait(18, signal); if (signal.aborted) return; yield item } }
  async importAnonymous(conversations: Conversation[]): Promise<ConversationSummaryPage> { const imported = conversations.map(item => { const copy = structuredClone(item); copy.id = toConversationId(createId()); copy.source = 'server'; this.conversations.set(copy.id, copy); return copy }); return { items: imported, next_cursor: null } }
  private getConversation(id: ConversationId): Conversation { const conversation = this.conversations.get(id); if (!conversation) throw new Error('conversation not found'); return conversation }
  private applyMockEvent(item: RunEvent): void { const run = this.runs.get(item.run_id); if (!run) return; if (item.type === 'run.status') run.state = item.payload.state; if (item.type === 'run.completed' || item.type === 'run.stopped' || item.type === 'run.failed') run.state = item.type === 'run.completed' ? 'completed' : item.type === 'run.stopped' ? 'stopped' : 'failed' }
}

export const mockAiApi = new MockAiApi()
/** 单测始终走 Mock；开发环境需显式 VITE_AI_MOCK=true。 */
const useMockAiApi = import.meta.env.MODE === 'test' || (import.meta.env.DEV && import.meta.env.VITE_AI_MOCK === 'true')
/** 页面与 Pinia 统一注入的 AI 客户端。 */
export const aiApi: AiApi = useMockAiApi ? mockAiApi : new HttpAiApi()
