import type { ApiError } from './errors.types'
import type { DeltaPayload, RunEvent, UsagePayload } from './runEvent.types'
import type { RunState } from './run.types'
import { RUN_STATES } from './runState'

/** 判断协议输入是否为可安全读取字段的普通对象。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string { return typeof value === 'string' }
function isPositiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 }
function hasOnlyKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  // SSE 属于安全边界：额外字段也视为协议不匹配，避免静默接受服务端漂移。
  const allowed = new Set([...required, ...optional])
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.has(key))
}
function isDateTime(value: unknown): value is string { return isString(value) && value.length <= 64 && !Number.isNaN(Date.parse(value)) }
function isNonNegativeInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function isPayloadDelta(value: unknown): value is DeltaPayload { return isRecord(value) && hasOnlyKeys(value, ['delta']) && isString(value.delta) && value.delta.length >= 1 && value.delta.length <= 65_536 }
function isRunStateValue(value: unknown): value is RunState { return isString(value) && RUN_STATES.some(state => state === value) }
function isUsagePayload(value: unknown): value is UsagePayload {
  if (!isRecord(value) || !hasOnlyKeys(value, ['input_cache_hit_tokens', 'input_cache_miss_tokens', 'output_tokens', 'reasoning_tokens', 'actual_micro_cny', 'usage_missing'])) return false
  return isNonNegativeInteger(value.input_cache_hit_tokens) && isNonNegativeInteger(value.input_cache_miss_tokens) && isNonNegativeInteger(value.output_tokens) && isNonNegativeInteger(value.reasoning_tokens) && isNonNegativeInteger(value.actual_micro_cny) && typeof value.usage_missing === 'boolean'
}
function isOptionalUsage(value: unknown): boolean { return value === undefined || isUsagePayload(value) }

/** 严格校验一帧未知数据是否符合公开 RunEvent 协议。 */
export function isRunEvent(value: unknown): value is RunEvent {
  if (!isRecord(value) || !hasOnlyKeys(value, ['v', 'seq', 'type', 'run_id', 'conversation_id', 'emitted_at', 'payload']) || value.v !== 1 || !isPositiveInteger(value.seq) || !isString(value.run_id) || value.run_id.length < 1 || value.run_id.length > 128 || !isString(value.conversation_id) || value.conversation_id.length < 1 || value.conversation_id.length > 128 || !isDateTime(value.emitted_at)) return false
  if (!isString(value.type) || !isRecord(value.payload)) return false
  const payload = value.payload
  switch (value.type) {
    case 'reasoning.delta': case 'answer.delta': return isPayloadDelta(payload)
    case 'run.created': return hasOnlyKeys(payload, ['state'], ['turn_id', 'assistant_message_id']) && isRunStateValue(payload.state) && (payload.turn_id === undefined || isString(payload.turn_id)) && (payload.assistant_message_id === undefined || isString(payload.assistant_message_id))
    case 'run.status': return hasOnlyKeys(payload, ['state']) && isRunStateValue(payload.state)
    case 'usage.final': return isUsagePayload(payload)
    case 'title.updated': return hasOnlyKeys(payload, ['title']) && isString(payload.title) && payload.title.length >= 1 && [...payload.title].length <= 80
    case 'run.completed': case 'run.stopped': return hasOnlyKeys(payload, ['finished_at', 'partial'], ['finish_reason', 'usage']) && isDateTime(payload.finished_at) && typeof payload.partial === 'boolean' && (payload.finish_reason === undefined || isString(payload.finish_reason)) && isOptionalUsage(payload.usage)
    case 'run.failed': return hasOnlyKeys(payload, ['code', 'retryable', 'partial'], ['finish_reason', 'usage']) && isString(payload.code) && payload.code.length >= 1 && payload.code.length <= 80 && typeof payload.retryable === 'boolean' && typeof payload.partial === 'boolean' && (payload.finish_reason === undefined || isString(payload.finish_reason)) && isOptionalUsage(payload.usage)
    default: return false
  }
}

/** 判断未知异常体是否包含页面可展示的标准错误字段。 */
export function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isString(value.code) && isString(value.message) && typeof value.retryable === 'boolean'
}
