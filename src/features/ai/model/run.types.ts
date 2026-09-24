import type { ApiError } from './errors.types'
import type { ConversationId, MessageId, PublicId, RunId, TurnId } from './ids'

/** AI 生成任务从预留额度到终止的生命周期状态。 */
export type RunState = 'reserved' | 'queued' | 'running' | 'completed' | 'stopped' | 'failed' | 'interrupted'
/** 浏览器 SSE 连接状态，与服务端 Run 状态相互独立。 */
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'backoff' | 'closed'
/** 请求模型使用的思考强度。 */
export type ReasoningEffort = 'low' | 'medium' | 'high'
/** 创建新回答、重新生成或编辑分叉三种操作。 */
export type RunOperation = 'send' | 'regenerate' | 'edit_and_fork'

/** 创建 Run 时冻结的额度预留快照。 */
export interface Reservation {
  /** 本次生成预扣的金额，单位为微元。 */
  reserved_micro_cny: number
  /** 计算预扣金额时采用的计价版本。 */
  price_version: number
}

/** 创建或恢复 Run 时返回的任务快照，不包含生成正文。 */
export interface RunRecord {
  /** Run 的公开 ID。 */
  run_id: RunId
  /** 本次任务执行的业务操作。 */
  operation: RunOperation
  /** Run 所属对话 ID。 */
  conversation_id: ConversationId
  /** Run 所属问答轮次 ID。 */
  turn_id: TurnId
  /** 本轮用户消息 ID；部分恢复响应可能缺省。 */
  user_message_id?: MessageId
  /** 本次生成对应的助手消息 ID。 */
  assistant_message_id: MessageId
  /** 服务端记录的 Run 生命周期状态。 */
  state: RunState
  /** 订阅该 Run 事件流的地址。 */
  events_url: string
  /** 创建任务时的额度预留信息。 */
  reservation: Reservation
}

/** POST 创建 Run 成功后的完整响应。 */
export interface AcceptedRunRecord extends RunRecord {
  /** 创建请求对应的用户消息 ID。 */
  user_message_id: MessageId
  /** 创建 Run 后最新的对话修订号。 */
  conversation_revision: number
  /** 首轮生成时服务端可能自动产生的对话标题。 */
  conversation_title?: string
}

/** AI 页面初始化所需的公开配置与当前身份额度。 */
export interface BootstrapData {
  /** AI 服务开关和维护提示。 */
  service: {
    /** 当前是否允许创建新的生成任务。 */
    enabled: boolean
    /** 服务不可用时展示给用户的维护说明。 */
    maintenance_message: string
  }
  /** 当前服务端允许的输入、输出和图片上限。 */
  limits: {
    /** 单次请求允许的最大文本字符数。 */
    max_input_chars: number
    /** 单次回答允许生成的最大 token 数。 */
    max_output_tokens: number
    /** 上传图片允许的最大字节数。 */
    max_image_bytes: number
    /** 上传图片允许的最大像素总数。 */
    max_image_pixels: number
  }
  /** 空对话页展示的推荐问题。 */
  suggested_prompts: string[]
  /** 当前访问身份及其剩余额度。 */
  identity: {
    /** 当前请求按匿名访客还是登录用户计费。 */
    kind: 'anonymous' | 'user'
    /** 当日剩余可回答轮数。 */
    rounds_remaining: number
    /** 当日剩余预算，单位为微元。 */
    budget_remaining_micro_cny: number
  }
}

/** 登录用户创建 Run 时提交的 JSON 元数据。 */
export interface CreateRunRequest {
  /** 客户端生成的幂等请求 ID。 */
  client_request_id: PublicId
  /** 本次要执行的生成操作。 */
  operation: RunOperation
  /** 目标对话 ID；新建对话时可以省略。 */
  conversation_id?: ConversationId
  /** 重新生成或编辑分叉所基于的源消息 ID。 */
  source_message_id?: MessageId
  /** 用户提交的文本；部分重新生成操作可以省略。 */
  content?: string
  /** 模型思考强度。 */
  reasoning_effort?: ReasoningEffort
}

/** 匿名请求携带的精简历史消息。 */
export interface AnonymousHistoryItem {
  /** 历史消息发送方。 */
  role: 'user' | 'assistant'
  /** 历史消息正文。 */
  content: string
}

/** 匿名用户发起一次性流式生成的请求体。 */
export interface AnonymousStreamRequest {
  /** 客户端生成的幂等请求 ID。 */
  client_request_id: PublicId
  /** 服务端已签发的匿名对话 ID；首轮可以省略。 */
  conversation_id?: ConversationId
  /** 当前轮用户输入正文。 */
  content: string
  /** 为模型提供上下文的精简匿名历史。 */
  history: AnonymousHistoryItem[]
  /** 模型思考强度。 */
  reasoning_effort?: ReasoningEffort
}

/** Pinia 中维护的一次生成任务的客户端运行状态。 */
export interface ClientRunState {
  /** Run 公开 ID。 */
  runId: RunId
  /** 本次任务的业务操作。 */
  operation: RunOperation
  /** Run 所属对话 ID。 */
  conversationId: ConversationId
  /** Run 所属轮次 ID。 */
  turnId: TurnId
  /** 正在写入的助手消息 ID。 */
  assistantMessageId: MessageId
  /** 当前 Run 生命周期状态。 */
  state: RunState
  /** 已接收并拼接的思考过程。 */
  reasoning: string
  /** 已接收并拼接的回答正文。 */
  answer: string
  /** 已确认的最大 SSE 公开序号。 */
  lastSeq: number
  /** 当前 SSE 连接状态。 */
  connection: ConnectionState
  /** 当前连续退避重连次数。 */
  reconnectAttempt: number
  /** 导致任务失败或断线的结构化错误。 */
  terminalError?: ApiError
  /** 终态内容是否只生成了一部分。 */
  partial: boolean
  /** 是否因事件缺口而需要从序号零重新回放。 */
  recoveryRequired?: boolean
  /** 用户已请求停止、但服务端终态事件尚未到达。 */
  stopOptimistic?: boolean
}
