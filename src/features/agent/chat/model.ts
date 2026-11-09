/** 智能体进程内协议；浏览器不持久化消息正文或凭据。 */
export interface ModelConfig {
  id: string // UUIDv7 格式的配置标识。
  name: string // 管理员识别配置的名称。
  provider: 'deepseek' // 任务 1 支持的供应商范围。
  model: string // 供应商模型名称。
  thinking_enabled: boolean // 显式模式开关。
  max_output_tokens: number // 供应商输出预留预算。
  context_budget_tokens: number // 完整请求的保守预算。
  enabled: boolean // 最多一条启用记录。
  revision: number // 管理员乐观并发控制修订号。
  has_api_key: boolean // 仅表示是否存在。
  credential_available: boolean // 当前部署解密凭据的健康状态。
  updated_at: string // UTC 时间点。
}

/** 完整可编辑字段；api_key 缺省时保留既有加密值。 */
export type ModelInput = Pick<ModelConfig, 'name' | 'provider' | 'model' | 'thinking_enabled' | 'max_output_tokens' | 'context_budget_tokens'> & { api_key?: string; revision: number }
/** 真实运行状态枚举，网络连接状态独立保存。 */
export type RunStatus = 'created' | 'running' | 'stopping' | 'completed' | 'stopped' | 'failed' | 'incomplete' | 'interrupted'
/** 生成终态不等于已保存，保存失败仍禁止同会话新发送。 */
export type PersistenceStatus = 'pending' | 'saving' | 'failed' | 'saved'
/** 服务端维护的有序消息。 */
export interface AgentMessage {
  message_id: string // 稳定的消息标识。
  message_seq: number // 会话内消息顺序。
  role: 'user' | 'assistant' // 由服务端控制的消息角色。
  text: string // 用户输入或回答正文。
  reasoning: string // 仅供展示的思考通道。
  run_id: string // 所属接纳运行。
  status: RunStatus // 部分回答保留真实终态标记。
  reason?: string // 可安全展示的未完成或失败说明。
}
/** 临时会话快照或摘要，摘要不包含消息。 */
export interface AgentChat {
  thinking_preference?: boolean // 下次发送偏好，与旧消息思考展示无关。
  next_cursor?: number // 更早消息的before_seq，缺省表示无更早页。
  watermark?: number // 本次消息页水位。
  chat_id: string // UUIDv7 格式的唯一标识。
  title: string // 用户可见的会话标题。
  revision: number // 重命名时使用的期望修订号。
  updated_at: string // UTC 时间点。
  current_run_id?: string // 尚未进入终态的运行标识。
  messages?: AgentMessage[] // 快照内容。
}
/** 原子运行快照；event_seq 精确对应当前累计内容。 */
export interface AgentRun {
  generation_status?: RunStatus // 与status兼容的显式生成维度。
  persistence_status?: PersistenceStatus // 与生成状态独立。
  source?: 'memory' | 'history' // PG快照以已提交事实为准。
  replay_available?: boolean // 历史快照不尝试旧事件环。
  thinking_requested?: boolean // 固定用户选择。
  thinking_effective?: boolean // 本轮真实模式。
  activity?: string // 正在加载、缩减或摘要。
  run_id: string // 当前流的标识。
  chat_id: string // 所属父资源标识。
  instance_id: string // 进程世代标识。
  user_message_id: string // 已接纳的用户消息。
  message_id: string // 助手消息标识。
  status: RunStatus // 真实生成状态。
  answer: string // 累计最终回答正文。
  reasoning: string // 累计思考内容。
  event_seq: number // 原子回放水位。
  reason?: string // 可安全展示的终态原因。
  model: ModelConfig // 可安全返回的固定模型元数据。
  usage?: Record<string, unknown> // 仅使用供应商实际提供的用量。
}
/** 带版本的应用事件，独立于 Eino 内部事件。 */
export interface AgentEvent {
  v: 1 // 契约版本。
  instance_id: string // 进程世代标识。
  chat_id: string // 所属会话标识。
  run_id: string // 绑定的事件流。
  seq: number // 单运行内严格递增。
  type: string // 稳定事件名称。
  payload: { text?: string; status?: RunStatus; reason?: string; usage?: Record<string, unknown>; persistence_status?: PersistenceStatus; activity?: string } // 可安全返回的事件数据。
}
/** 用户启动信息不包含管理员专属配置详情。 */
export interface AgentBootstrap {
  persistent_history?: boolean // 重启后保留会话身份，连接按新世代重建。
  instance_id: string // 进程世代标识。
  available: boolean // 功能、启用配置及密钥均可用时为真。
  model?: { model: string; thinking_enabled: boolean; thinking_allowed?: boolean } // 后台许可，不表示用户已开启。
  limits: { max_input_bytes: number; user_concurrency: number; user_max_chats?: number; max_messages?: number } // 旧临时模式字段可缺省，不限制持久历史总量。
}
/** 已保存配置的手动探测结果，不包含供应商输出正文或密钥。 */
export interface ModelTestResult {
  success: boolean // 已观测真实完整生成及所选模式的输出通道。
  duration_ms: number // 实际耗时。
  saw_reasoning: boolean // 是否观测到实际思考输出。
  saw_answer: boolean // 是否观测到实际回答输出。
  reason: string // 可安全展示的结果说明。
}
/** 仅在执行器实际退出后为真。 */
export function terminal(status: RunStatus): boolean { return ['completed', 'stopped', 'failed', 'incomplete', 'interrupted'].includes(status) }
/** 保存pending/saving时继续订阅；failed关闭连接并提供显式重试。 */
export function streamFinished(run: AgentRun): boolean { return terminal(run.status) && (!run.persistence_status || run.persistence_status === 'saved' || run.persistence_status === 'failed') }
/** 保存失败仍busy，不能用生成终态提前解锁。 */
export function busy(run: AgentRun): boolean { return !terminal(run.status) || !!run.persistence_status && run.persistence_status !== 'saved' }

/** 仅应用连续帧；快照替换由订阅所有者负责。 */
export function applyEvent(run: AgentRun, event: AgentEvent): 'applied' | 'duplicate' | 'gap' {
  if (event.instance_id !== run.instance_id || event.run_id !== run.run_id || event.chat_id !== run.chat_id) throw new Error('运行事件身份不匹配')
  if (event.seq <= run.event_seq) return 'duplicate'
  if (event.seq !== run.event_seq + 1) return 'gap'
  if (event.type === 'answer.delta') run.answer += event.payload.text ?? ''
  if (event.type === 'reasoning.delta') run.reasoning += event.payload.text ?? ''
  if (event.payload.status) { run.status = event.payload.status; run.generation_status = event.payload.status }
  if (event.payload.persistence_status) run.persistence_status = event.payload.persistence_status
  if (event.payload.activity !== undefined) run.activity = event.payload.activity
  if (event.payload.reason) run.reason = event.payload.reason
  if (event.type === 'usage.final') run.usage = event.payload.usage
  run.event_seq = event.seq
  return 'applied'
}
