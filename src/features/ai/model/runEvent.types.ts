import type { ConversationId, MessageId, RunId, TurnId } from './ids'
import type { RunState } from './run.types'

/** Run 创建事件携带的初始关联信息。 */
export interface RunCreatedPayload {
  /** Run 创建后的初始状态。 */
  state: RunState
  /** 服务端分配的问答轮次 ID。 */
  turn_id?: TurnId
  /** 服务端分配的助手消息 ID。 */
  assistant_message_id?: MessageId
}
/** Run 状态变化事件的载荷。 */
export interface RunStatusPayload {
  /** 变更后的 Run 状态。 */
  state: RunState
}
/** 思考或回答增量事件的载荷。 */
export interface DeltaPayload {
  /** 本事件新增的文本片段。 */
  delta: string
}
/** 一次生成最终确认的 token 与费用用量。 */
export interface UsagePayload {
  /** 命中上游缓存的输入 token 数。 */
  input_cache_hit_tokens: number
  /** 未命中缓存的输入 token 数。 */
  input_cache_miss_tokens: number
  /** 回答正文使用的输出 token 数。 */
  output_tokens: number
  /** 思考过程使用的 token 数。 */
  reasoning_tokens: number
  /** 本次生成实际费用，单位为微元。 */
  actual_micro_cny: number
  /** 上游是否缺少可靠用量数据。 */
  usage_missing: boolean
}
/** 对话标题更新事件的载荷。 */
export interface TitleUpdatedPayload {
  /** 服务端生成或更新后的对话标题。 */
  title: string
}
/** Run 正常完成或被停止时的终态载荷。 */
export interface TerminalPayload {
  /** Run 进入终态的时间。 */
  finished_at: string
  /** 生成结束原因。 */
  finish_reason?: string
  /** 当前回答是否为不完整内容。 */
  partial: boolean
  /** 服务端已结算时附带的最终用量。 */
  usage?: UsagePayload
}
/** Run 失败事件的载荷。 */
export interface FailedPayload {
  /** 稳定失败错误码。 */
  code: string
  /** 该失败是否允许重试。 */
  retryable: boolean
  /** 失败前是否已经生成部分内容。 */
  partial: boolean
  /** 导致生成结束的具体原因。 */
  finish_reason?: string
  /** 失败前已产生并完成结算的用量。 */
  usage?: UsagePayload
}

/** 所有 SSE Run 事件共同拥有的信封字段。 */
interface RunEventEnvelope<TType extends string, TPayload> {
  /** 事件协议版本，当前固定为 1。 */
  v: 1
  /** Run 内从 1 开始连续递增的公开事件序号。 */
  seq: number
  /** 用于判别联合类型的事件名称。 */
  type: TType
  /** 产生该事件的 Run ID。 */
  run_id: RunId
  /** 该 Run 所属的对话 ID。 */
  conversation_id: ConversationId
  /** 服务端发出事件的时间。 */
  emitted_at: string
  /** 随事件类型变化的业务载荷。 */
  payload: TPayload
}

/** 浏览器能够接收并交给 Store 处理的 SSE 事件。 */
export type RunEvent =
  | RunEventEnvelope<'run.created', RunCreatedPayload>
  | RunEventEnvelope<'run.status', RunStatusPayload>
  | RunEventEnvelope<'reasoning.delta', DeltaPayload>
  | RunEventEnvelope<'answer.delta', DeltaPayload>
  | RunEventEnvelope<'usage.final', UsagePayload>
  | RunEventEnvelope<'title.updated', TitleUpdatedPayload>
  | RunEventEnvelope<'run.completed', TerminalPayload>
  | RunEventEnvelope<'run.stopped', TerminalPayload>
  | RunEventEnvelope<'run.failed', FailedPayload>
