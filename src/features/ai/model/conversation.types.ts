import type { ConversationId, MessageId, RunId, TurnId } from './ids'

/** 对话存储位置：ephemeral 为浏览器匿名会话，server 为服务端持久化会话。 */
export type ConversationSource = 'ephemeral' | 'server'

/** 同一问答轮次中的一个助手回答版本。 */
export interface AssistantVersion {
  /** 助手消息的公开 ID。 */
  id: MessageId
  /** 最终展示给用户的回答正文。 */
  content: string
  /** 模型生成的思考过程文本。 */
  reasoning: string
  /** 回答当前的生成结果状态。 */
  status: 'partial' | 'complete' | 'stopped' | 'failed'
  /** 生成结束原因，例如达到最大输出长度。 */
  finish_reason?: string
  /** 该回答版本的创建时间，使用服务端时间字符串。 */
  created_at: string
}

/** 用户在一个问答轮次中提交的消息。 */
export interface UserMessage {
  /** 用户消息的公开 ID。 */
  id: MessageId
  /** 固定为 user，用于区分消息角色。 */
  role: 'user'
  /** 用户输入的文本正文。 */
  content: string
  /** 本轮是否曾附带图片；图片本体不会写入消息模型。 */
  had_image?: boolean
  /** 用户消息的创建时间。 */
  created_at: string
}

/** 页面展示的一轮问答，由一条用户消息和多个助手版本组成。 */
export interface TurnViewModel {
  /** 问答轮次公开 ID。 */
  id: TurnId
  /** 本轮的用户消息。 */
  user: UserMessage
  /** 本轮生成过的所有助手回答版本。 */
  assistant_versions: AssistantVersion[]
  /** 当前选中并展示的助手消息 ID；缺省时使用首个版本。 */
  selected_assistant_id?: MessageId
}

/** 对话列表接口返回的轻量摘要，不包含消息正文。 */
export interface ConversationSummary {
  /** 对话公开 ID。 */
  id: ConversationId
  /** 对话标题。 */
  title: string
  /** 对话位于浏览器本地还是服务端。 */
  source: ConversationSource
  /** 对话最后更新时间。 */
  updated_at: string
  /** 服务端并发控制修订号。 */
  revision?: number
  /** 对话内按顺序排列的轮次 ID。 */
  turn_ids: TurnId[]
  /** 当前仍在生成的 Run ID；没有进行中任务时缺省。 */
  active_run_id?: RunId
}

/** 页面使用的完整对话模型。 */
export interface Conversation extends ConversationSummary {
  /** 已加载并组装的问答轮次。 */
  turns: TurnViewModel[]
}

/** 对话摘要的游标分页结果。 */
export interface ConversationSummaryPage {
  /** 当前页的对话摘要。 */
  items: ConversationSummary[]
  /** 下一页游标；null 表示没有下一页。 */
  next_cursor: string | null
}

/** 历史消息接口返回的扁平消息 DTO。 */
export interface HistoryMessage {
  /** 消息公开 ID。 */
  id: MessageId
  /** 消息发送方。 */
  role: 'user' | 'assistant'
  /** 消息正文。 */
  content: string
  /** 助手思考过程；用户消息通常为空字符串。 */
  reasoning_content: string
  /** 消息生成或持久化状态。 */
  status: 'pending' | 'streaming' | 'completed' | 'stopped' | 'failed' | 'interrupted'
  /** 消息结束原因；尚未结束或无明确原因时为 null。 */
  finish_reason: string | null
  /** 用户消息是否曾附带图片。 */
  had_image?: boolean
  /** 消息所属问答轮次 ID。 */
  turn_id?: TurnId
  /** 轮次在对话中的零基序号。 */
  turn_index?: number
  /** 同一轮次中助手回答的版本号。 */
  version?: number
  /** 消息创建时间。 */
  created_at?: string
  /** 消息最后更新时间。 */
  updated_at?: string
}

/** 历史消息的游标分页结果。 */
export interface MessagePage {
  /** 当前页的历史消息。 */
  items: HistoryMessage[]
  /** 下一页游标；null 表示没有下一页。 */
  next_cursor: string | null
}

/** 切换当前助手回答版本后的服务端结果。 */
export interface VersionSelectionResult {
  /** 切换后需要合并进页面的消息快照。 */
  items: HistoryMessage[]
  /** 更新后的对话修订号。 */
  conversation_revision: number
  /** 更新后的问答轮次修订号。 */
  turn_revision: number
  /** 服务端确认的当前助手消息 ID。 */
  selected_assistant_id: MessageId
}
