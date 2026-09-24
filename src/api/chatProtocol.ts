/**
 * 静语 HTTP 响应的运行时校验。
 *
 * 后端 JSON 一旦缺字段、多字段或类型不对，就抛 AiProtocolError，
 * 避免把半残数据写进 Pinia。path 指向出错的 JSON 路径，便于对照抓包。
 */
import {
  RUN_STATES,
  toConversationId,
  toMessageId,
  toRunId,
  toTurnId,
  type BootstrapData,
  type Conversation,
  type ConversationSummary,
  type ConversationSummaryPage,
  type HistoryMessage,
  type MessagePage,
  type VersionSelectionResult,
  type AcceptedRunRecord,
  type RunRecord
} from '@/features/ai/model'

/** 协议破坏：响应形状与前端契约不一致。 */
export class AiProtocolError extends Error {
  /**
   * @param path 出错的 JSON 路径，例如 `bootstrap.limits.max_input_chars`
   */
  constructor(path: string) {
    super(`静语接口响应不符合协议：${path}`)
    this.name = 'AiProtocolError'
  }
}

/** 要求 value 是普通对象，否则按 path 报协议错误。 */
function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AiProtocolError(path)
  return value as Record<string, unknown>
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new AiProtocolError(path)
  return value
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new AiProtocolError(path)
  return value
}

function positiveInteger(value: unknown, path: string): number {
  const parsed = nonNegativeInteger(value, path)
  if (parsed < 1) throw new AiProtocolError(path)
  return parsed
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : string(value, path)
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path)
}

function isRunState(value: string): value is RunRecord['state'] {
  return RUN_STATES.some(state => state === value)
}

/** 解析会话摘要 DTO。source 只允许 server / ephemeral。 */
export function parseConversationSummary(value: unknown, path = 'conversation'): ConversationSummary {
  const input = record(value, path)
  if (input.source !== 'server' && input.source !== 'ephemeral') throw new AiProtocolError(`${path}.source`)
  if (!Array.isArray(input.turn_ids) || !input.turn_ids.every(item => typeof item === 'string')) throw new AiProtocolError(`${path}.turn_ids`)
  const revision = input.revision === undefined ? undefined : nonNegativeInteger(input.revision, `${path}.revision`)
  const activeRunId = optionalString(input.active_run_id, `${path}.active_run_id`)
  return {
    id: toConversationId(string(input.id, `${path}.id`)),
    title: string(input.title, `${path}.title`),
    source: input.source,
    updated_at: string(input.updated_at, `${path}.updated_at`),
    turn_ids: input.turn_ids.map(item => toTurnId(item)),
    ...(revision === undefined ? {} : { revision }),
    ...(activeRunId === undefined ? {} : { active_run_id: toRunId(activeRunId) })
  }
}

/**
 * 把摘要 DTO 合成页面 Conversation。
 * 列表接口经常带回空 turn_ids；若本地已有 turns，必须保留，否则 hydrate 前气泡会闪没。
 * @param previous 本地已有的对话（含 turns / active_run_id）
 */
export function normalizeConversation(summary: ConversationSummary, previous?: Partial<Conversation>): Conversation {
  const previousTurnIds = Array.isArray(previous?.turn_ids) ? previous.turn_ids : []
  const previousTurns = Array.isArray(previous?.turns) ? previous.turns : []
  const preserveLocalTurns = summary.turn_ids.length === 0 && previousTurnIds.length > 0
  return {
    ...summary,
    turn_ids: preserveLocalTurns ? [...previousTurnIds] : [...summary.turn_ids],
    turns: previousTurns.map(turn => ({ ...turn, assistant_versions: Array.isArray(turn.assistant_versions) ? [...turn.assistant_versions] : [] })),
    ...(summary.active_run_id === undefined && previous?.active_run_id !== undefined ? { active_run_id: previous.active_run_id } : {})
  }
}

/** 解析会话列表分页。 */
export function parseConversationSummaryPage(value: unknown): ConversationSummaryPage {
  const input = record(value, 'conversation_page')
  if (!Array.isArray(input.items)) throw new AiProtocolError('conversation_page.items')
  return {
    items: input.items.map((item, index) => parseConversationSummary(item, `conversation_page.items[${index}]`)),
    next_cursor: nullableString(input.next_cursor, 'conversation_page.next_cursor')
  }
}

/** 解析一条历史消息。status / role / turn_index 均为必填。 */
function parseHistoryMessage(value: unknown, index: number): HistoryMessage {
  const path = `message_page.items[${index}]`
  const input = record(value, path)
  if (input.role !== 'user' && input.role !== 'assistant') throw new AiProtocolError(`${path}.role`)
  const turnIndex = nonNegativeInteger(input.turn_index, `${path}.turn_index`)
  const version = positiveInteger(input.version, `${path}.version`)
  const hadImage = input.had_image === undefined ? undefined : input.had_image
  if (hadImage !== undefined && typeof hadImage !== 'boolean') throw new AiProtocolError(`${path}.had_image`)
  const status = string(input.status, `${path}.status`)
  if (!['pending', 'streaming', 'completed', 'stopped', 'failed', 'interrupted'].includes(status)) throw new AiProtocolError(`${path}.status`)
  return {
    id: toMessageId(string(input.id, `${path}.id`)),
    role: input.role,
    content: string(input.content, `${path}.content`),
    reasoning_content: string(input.reasoning_content, `${path}.reasoning_content`),
    status: status as HistoryMessage['status'],
    finish_reason: nullableString(input.finish_reason, `${path}.finish_reason`),
    ...(hadImage === undefined ? {} : { had_image: hadImage }),
    turn_id: toTurnId(string(input.turn_id, `${path}.turn_id`)),
    turn_index: turnIndex,
    version,
    created_at: string(input.created_at, `${path}.created_at`),
    updated_at: string(input.updated_at, `${path}.updated_at`)
  }
}

/** 解析消息分页。 */
export function parseMessagePage(value: unknown): MessagePage {
  const input = record(value, 'message_page')
  if (!Array.isArray(input.items)) throw new AiProtocolError('message_page.items')
  return {
    items: input.items.map(parseHistoryMessage),
    next_cursor: nullableString(input.next_cursor, 'message_page.next_cursor')
  }
}

/** 解析选版本命令结果；selected_assistant_id 必须出现在 items 的助手消息里。 */
export function parseVersionSelectionResult(value: unknown): VersionSelectionResult {
  const input = record(value, 'version_selection')
  if (!Array.isArray(input.items)) throw new AiProtocolError('version_selection.items')
  const page = parseMessagePage({ items: input.items, next_cursor: null })
  const selectedAssistantId = toMessageId(string(input.selected_assistant_id, 'version_selection.selected_assistant_id'))
  if (!page.items.some(item => item.role === 'assistant' && item.id === selectedAssistantId)) {
    throw new AiProtocolError('version_selection.selected_assistant_id')
  }
  return {
    items: page.items,
    conversation_revision: nonNegativeInteger(input.conversation_revision, 'version_selection.conversation_revision'),
    turn_revision: nonNegativeInteger(input.turn_revision, 'version_selection.turn_revision'),
    selected_assistant_id: selectedAssistantId
  }
}

/** 解析 Run 快照。operation / state / reservation 都做枚举与非负校验。 */
export function parseRunRecord(value: unknown, path = 'run'): RunRecord {
  const input = record(value, path)
  const state = string(input.state, `${path}.state`)
  if (!isRunState(state)) throw new AiProtocolError(`${path}.state`)
  const operation = string(input.operation, `${path}.operation`)
  if (operation !== 'send' && operation !== 'regenerate' && operation !== 'edit_and_fork') throw new AiProtocolError(`${path}.operation`)
  const reservation = record(input.reservation, `${path}.reservation`)
  return {
    run_id: toRunId(string(input.run_id, `${path}.run_id`)),
    operation,
    conversation_id: toConversationId(string(input.conversation_id, `${path}.conversation_id`)),
    turn_id: toTurnId(string(input.turn_id, `${path}.turn_id`)),
    ...(input.user_message_id === undefined ? {} : { user_message_id: toMessageId(string(input.user_message_id, `${path}.user_message_id`)) }),
    assistant_message_id: toMessageId(string(input.assistant_message_id, `${path}.assistant_message_id`)),
    state,
    events_url: string(input.events_url, `${path}.events_url`),
    reservation: {
      reserved_micro_cny: nonNegativeInteger(reservation.reserved_micro_cny, `${path}.reservation.reserved_micro_cny`),
      price_version: positiveInteger(reservation.price_version, `${path}.reservation.price_version`)
    }
  }
}

/** 解析创建 Run 的接受记录；比 RunRecord 强制要求 user_message_id。 */
export function parseAcceptedRunRecord(value: unknown, path = 'accepted_run'): AcceptedRunRecord {
  const run = parseRunRecord(value, path)
  if (!run.user_message_id) throw new AiProtocolError(`${path}.user_message_id`)
  const input = record(value, path)
  return {
    ...run,
    user_message_id: run.user_message_id,
    conversation_revision: nonNegativeInteger(input.conversation_revision, `${path}.conversation_revision`),
    ...(input.conversation_title === undefined ? {} : { conversation_title: string(input.conversation_title, `${path}.conversation_title`) })
  }
}

/** 解析 active runs 列表。服务端包在 `{ items: [...] }` 里。 */
export function parseRunPage(value: unknown): RunRecord[] {
  const input = record(value, 'run_page')
  if (!Array.isArray(input.items)) throw new AiProtocolError('run_page.items')
  return input.items.map((item, index) => parseRunRecord(item, `run_page.items[${index}]`))
}

/** 解析 bootstrap。identity.kind 只允许 anonymous / user。 */
export function parseBootstrapData(value: unknown): BootstrapData {
  const input = record(value, 'bootstrap')
  const service = record(input.service, 'bootstrap.service')
  const limits = record(input.limits, 'bootstrap.limits')
  const identity = record(input.identity, 'bootstrap.identity')
  if (typeof service.enabled !== 'boolean') throw new AiProtocolError('bootstrap.service.enabled')
  if (!Array.isArray(input.suggested_prompts) || !input.suggested_prompts.every(item => typeof item === 'string')) throw new AiProtocolError('bootstrap.suggested_prompts')
  if (identity.kind !== 'anonymous' && identity.kind !== 'user') throw new AiProtocolError('bootstrap.identity.kind')
  return {
    service: { enabled: service.enabled, maintenance_message: string(service.maintenance_message, 'bootstrap.service.maintenance_message') },
    limits: {
      max_input_chars: positiveInteger(limits.max_input_chars, 'bootstrap.limits.max_input_chars'),
      max_output_tokens: positiveInteger(limits.max_output_tokens, 'bootstrap.limits.max_output_tokens'),
      max_image_bytes: positiveInteger(limits.max_image_bytes, 'bootstrap.limits.max_image_bytes'),
      max_image_pixels: positiveInteger(limits.max_image_pixels, 'bootstrap.limits.max_image_pixels')
    },
    suggested_prompts: [...input.suggested_prompts],
    identity: {
      kind: identity.kind,
      rounds_remaining: nonNegativeInteger(identity.rounds_remaining, 'bootstrap.identity.rounds_remaining'),
      budget_remaining_micro_cny: nonNegativeInteger(identity.budget_remaining_micro_cny, 'bootstrap.identity.budget_remaining_micro_cny')
    }
  }
}
