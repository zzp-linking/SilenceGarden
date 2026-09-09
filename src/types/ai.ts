export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type PublicId = Brand<string, 'PublicId'>
export type ConversationId = Brand<string, 'ConversationId'>
export type TurnId = Brand<string, 'TurnId'>
export type RunId = Brand<string, 'RunId'>
export type MessageId = Brand<string, 'MessageId'>

export function toPublicId(value: string): PublicId {
  return value as PublicId
}

export function toConversationId(value: string): ConversationId {
  return value as ConversationId
}

export function toTurnId(value: string): TurnId {
  return value as TurnId
}

export function toRunId(value: string): RunId {
  return value as RunId
}

export function toMessageId(value: string): MessageId {
  return value as MessageId
}

export const RUN_STATES = ['reserved', 'queued', 'running', 'stopping', 'completed', 'stopped', 'failed', 'interrupted'] as const
export type RunState = typeof RUN_STATES[number]
export const TERMINAL_RUN_STATES: readonly RunState[] = ['completed', 'stopped', 'failed', 'interrupted']
export const ACTIVE_RUN_STATES: readonly RunState[] = ['reserved', 'queued', 'running', 'stopping']
export function isTerminalRunState(state: RunState): boolean { return TERMINAL_RUN_STATES.includes(state) }
export function isActiveRunState(state: RunState): boolean { return ACTIVE_RUN_STATES.includes(state) }
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'backoff' | 'closed'
export type ReasoningEffort = 'low' | 'medium' | 'high'
export type RunOperation = 'send' | 'regenerate' | 'edit_and_fork'

export interface ApiError {
  code: string
  message: string
  retryable: boolean
  requestId?: string
  details?: Record<string, unknown>
}

export interface ApiEnvelope<T> {
  data: T
  request_id: string
}

export interface ApiErrorEnvelope {
  error: ApiError
}

export interface Reservation {
  reserved_micro_cny: number
  price_version: number
}

export interface RunRecord {
  run_id: RunId
  operation: RunOperation
  conversation_id: ConversationId
  turn_id: TurnId
  user_message_id?: MessageId
  assistant_message_id: MessageId
  state: RunState
  events_url: string
  reservation: Reservation
}

export interface AcceptedRunRecord extends RunRecord {
  user_message_id: MessageId
  conversation_revision: number
  conversation_title?: string
}

export interface BootstrapData {
  service: { enabled: boolean; maintenance_message: string }
  limits: { max_input_chars: number; max_output_tokens: number; max_image_bytes: number; max_image_pixels: number }
  suggested_prompts: string[]
  identity: { kind: 'anonymous' | 'user'; rounds_remaining: number; budget_remaining_micro_cny: number }
}

export type ConversationSource = 'ephemeral' | 'server'

export interface AssistantVersion {
  id: MessageId
  content: string
  reasoning: string
  status: 'partial' | 'complete' | 'stopped' | 'failed'
  finish_reason?: string
  created_at: string
}

export interface UserMessage {
  id: MessageId
  role: 'user'
  content: string
  had_image?: boolean
  created_at: string
}

export interface TurnViewModel {
  id: TurnId
  user: UserMessage
  assistant_versions: AssistantVersion[]
  selected_assistant_id?: MessageId
}

// ConversationSummary is the frozen HTTP DTO. Message content is fetched from
// /conversations/{id}/messages and is deliberately absent from this shape.
export interface ConversationSummary {
  id: ConversationId
  title: string
  source: ConversationSource
  updated_at: string
  revision?: number
  turn_ids: TurnId[]
  active_run_id?: RunId
}

// Conversation is the stable UI model. Unlike the summary DTO, turns is
// always present, including for a newly-created or not-yet-hydrated chat.
export interface Conversation extends ConversationSummary {
  turns: TurnViewModel[]
}

export interface ConversationSummaryPage {
  items: ConversationSummary[]
  next_cursor: string | null
}

export interface HistoryMessage {
  id: MessageId
  role: 'user' | 'assistant'
  content: string
  reasoning_content: string
  status: 'pending' | 'streaming' | 'completed' | 'stopped' | 'failed' | 'interrupted'
  finish_reason: string | null
  had_image?: boolean
  turn_id?: TurnId
  turn_index?: number
  version?: number
  created_at?: string
  updated_at?: string
}

export interface MessagePage {
  items: HistoryMessage[]
  next_cursor: string | null
}

// VersionSelectionResult is a command result, not a history page. Revisions
// let the UI keep later CAS commands aligned after summary invalidation.
export interface VersionSelectionResult {
  items: HistoryMessage[]
  conversation_revision: number
  turn_revision: number
  selected_assistant_id: MessageId
}

export interface CreateRunRequest {
  client_request_id: PublicId
  operation: RunOperation
  conversation_id?: ConversationId
  source_message_id?: MessageId
  content?: string
  reasoning_effort?: ReasoningEffort
}

export interface AnonymousHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface AnonymousStreamRequest {
  client_request_id: PublicId
  content: string
  history: AnonymousHistoryItem[]
  reasoning_effort?: ReasoningEffort
}

export interface ClientRunState {
  runId: RunId
  operation: RunOperation
  conversationId: ConversationId
  turnId: TurnId
  assistantMessageId: MessageId
  state: RunState
  reasoning: string
  answer: string
  lastSeq: number
  connection: ConnectionState
  reconnectAttempt: number
  terminalError?: ApiError
  partial: boolean
}

export interface RunCreatedPayload { state: RunState; turn_id: TurnId; assistant_message_id: MessageId }
export interface RunStatusPayload { state: RunState; message?: string }
export interface DeltaPayload { delta: string }
export interface SnapshotPayload { through_seq: number; reasoning: string; answer: string }
export interface UsagePayload { input_tokens: number; output_tokens: number; reasoning_tokens: number; actual_micro_cny: number }
export interface TitleUpdatedPayload { title: string; source: 'automatic' | 'manual' | 'fallback' }
export interface TerminalPayload { finished_at: string; finish_reason?: string; partial?: boolean }
export interface FailedPayload { code: string; retryable: boolean; partial: boolean }

export type RunEvent =
  | { v: 1; seq: number; type: 'run.created'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: RunCreatedPayload }
  | { v: 1; seq: number; type: 'run.status'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: RunStatusPayload }
  | { v: 1; seq: number; type: 'reasoning.delta'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: DeltaPayload }
  | { v: 1; seq: number; type: 'answer.delta'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: DeltaPayload }
  | { v: 1; seq: number; type: 'run.snapshot'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: SnapshotPayload }
  | { v: 1; seq: number; type: 'usage.final'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: UsagePayload }
  | { v: 1; seq: number; type: 'title.updated'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: TitleUpdatedPayload }
  | { v: 1; seq: number; type: 'run.completed'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: TerminalPayload }
  | { v: 1; seq: number; type: 'run.stopped'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: TerminalPayload }
  | { v: 1; seq: number; type: 'run.failed'; run_id: RunId; conversation_id: ConversationId; emitted_at: string; payload: FailedPayload }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string { return typeof value === 'string' }
function isPositiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 }
function isPayloadDelta(value: unknown): value is DeltaPayload { return isRecord(value) && isString(value.delta) }
function isRunStateValue(value: unknown): value is RunState { return isString(value) && RUN_STATES.some(state => state === value) }

export function isRunEvent(value: unknown): value is RunEvent {
  if (!isRecord(value) || value.v !== 1 || !isPositiveInteger(value.seq) || !isString(value.run_id) || !isString(value.conversation_id) || !isString(value.emitted_at)) return false
  if (!isString(value.type) || !isRecord(value.payload)) return false
  const payload = value.payload
  switch (value.type) {
    case 'reasoning.delta': case 'answer.delta': return isPayloadDelta(payload)
    case 'run.created': return isRunStateValue(payload.state) && isString(payload.turn_id) && isString(payload.assistant_message_id)
    case 'run.status': return isRunStateValue(payload.state)
    case 'run.snapshot': return typeof payload.through_seq === 'number' && Number.isInteger(payload.through_seq) && payload.through_seq >= 0 && isString(payload.reasoning) && isString(payload.answer)
    case 'usage.final': return ['input_tokens', 'output_tokens', 'reasoning_tokens', 'actual_micro_cny'].every(key => typeof payload[key] === 'number' && payload[key] >= 0)
    case 'title.updated': return isString(payload.title) && ['automatic', 'manual', 'fallback'].includes(String(payload.source))
    case 'run.completed': case 'run.stopped': return isString(payload.finished_at)
    case 'run.failed': return isString(payload.code) && typeof payload.retryable === 'boolean' && typeof payload.partial === 'boolean'
    default: return false
  }
}

export function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isString(value.code) && isString(value.message) && typeof value.retryable === 'boolean'
}
