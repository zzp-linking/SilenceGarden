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
/** 可信引用由检索结果生成，文件路径和模型提供的 URL 不进入投影。 */
export interface AgentSource {
  kind?: 'web_search' | 'web_fetch' // 缺省为知识库引用。
  url?: string // 仅网页来源有经过服务端验证的地址。
  knowledge_base_id?: string // 来源所属知识库，兼容此前保存的引用。
  id: string // 运行内引用标识。
  title: string // 来源标题。
  document_id: string // 原文文档标识。
  chunk_id: string // 命中片段标识。
  index_version_id: string // 来源索引版本。
  heading?: string[] // 可选章节路径。
  page?: number // 可选原文起始页。
}
/** 对话附件只暴露下载标识和展示信息。 */
export interface AgentArtifact {
  asset_id: string // 同源授权下载标识。
  name: string // 用户可见文件名。
  media_type: string // 已验证的文件类型。
  byte_size: number // 实际文件字节数。
  expires_at: string // 下载失效时间。
}
/** 固定的计划动作类别及状态，步骤不携带模型生成的文案。 */
export const planKinds = ['knowledge', 'history', 'search', 'read', 'download', 'export', 'answer'] as const
export const planStatuses = ['pending', 'running', 'completed', 'failed', 'skipped', 'interrupted'] as const
/** 计划只展示有序步骤和已确认版本。 */
export interface AgentPlan {
  plan_version: number // 运行内单调递增的版本。
  steps: {
    step_id: number // 从 1 起连续编号。
    kind: typeof planKinds[number] // 固定业务动作。
    status: typeof planStatuses[number] // 真实调用或终态推导出的进度。
  }[]
}
/** 服务端维护的有序消息。 */
export interface AgentMessage {
  plan?: AgentPlan // 此回答已提交的终态计划。
  sources?: AgentSource[] // 关联到此回答的已校验来源。
  artifacts?: AgentArtifact[] // 此回答产生的已确认附件。
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
  plan?: AgentPlan // 当前运行已提交的最新计划。
  generation_status?: RunStatus // 与status兼容的显式生成维度。
  persistence_status?: PersistenceStatus // 与生成状态独立。
  source?: 'memory' | 'history' // PG快照以已提交事实为准。
  replay_available?: boolean // 历史快照不尝试旧事件环。
  thinking_requested?: boolean // 固定用户选择。
  thinking_effective?: boolean // 本轮真实模式。
  activity?: string // 由实际执行流程产生的当前动作。
  tool_name?: string // 正在执行的工具名，仅用于固定标签映射。
  tool_notice?: string // 当前模型或依赖导致的工具可用性提示。
  sources?: AgentSource[] // 终态来源投影，与历史快照一致。
  artifacts?: AgentArtifact[] // 可从已提交日志恢复的附件。
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
  payload: {
    text?: string // 流式正文增量。
    status?: RunStatus // 已确认生成状态。
    reason?: string // 安全的结束说明。
    usage?: Record<string, unknown> // 供应商已报告用量。
    persistence_status?: PersistenceStatus // 历史保存状态。
    activity?: string // 只读的当前动作。
    tool_name?: string // 本次实际启动的工具。
    sources?: AgentSource[] // 终态已确认来源。
    artifacts?: AgentArtifact[] // 终态已确认附件。
    plan_version?: number // run.plan 当前提交版本。
    steps?: AgentPlan['steps'] // run.plan 当前提交步骤。
  }
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
  if (event.type === 'answer.reset') run.answer = '' // 模型本轮转入工具调用，撤回临时正文。
  if (event.type === 'reasoning.delta') run.reasoning += event.payload.text ?? ''
  if (event.payload.status) { run.status = event.payload.status; run.generation_status = event.payload.status }
  if (event.payload.persistence_status) run.persistence_status = event.payload.persistence_status
  if (event.type === 'run.activity') {
    run.activity = event.payload.activity
    run.tool_name = event.payload.tool_name
  }
  if (event.payload.sources) run.sources = event.payload.sources
  if (event.payload.artifacts) run.artifacts = event.payload.artifacts
  if (event.type === 'run.plan') {
    const next = { plan_version: event.payload.plan_version, steps: event.payload.steps }
    if (isAgentPlan(next) && next.plan_version > (run.plan?.plan_version ?? 0)) run.plan = next
  }
  if (terminal(run.status)) {
    run.activity = undefined
    run.tool_name = undefined
  }
  if (event.payload.reason) run.reason = event.payload.reason
  if (event.type === 'usage.final') run.usage = event.payload.usage
  run.event_seq = event.seq
  return 'applied'
}

/** 检查网络计划的版本、步数、顺序及枚举，拒绝超出约定的展示数据。 */
export function isAgentPlan(value: unknown): value is AgentPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as Record<string, unknown>
  return typeof plan.plan_version === 'number' && Number.isSafeInteger(plan.plan_version) && plan.plan_version > 0 &&
    Array.isArray(plan.steps) && plan.steps.length >= 2 && plan.steps.length <= 6 && plan.steps.every((raw, index) => {
      if (!raw || typeof raw !== 'object') return false
      const step = raw as Record<string, unknown>
      return step.step_id === index + 1 && planKinds.some(kind => kind === step.kind) &&
        planStatuses.some(status => status === step.status)
    })
}

/** source 来自网络事件，先核对公开结构再交给界面。 */
export function isAgentSource(source: unknown): source is AgentSource {
  if (!source || typeof source !== 'object') return false
  const item = source as Record<string, unknown>
  return typeof item.id === 'string' && /^s[1-9]\d*$/.test(item.id) &&
    [item.title, item.document_id, item.chunk_id, item.index_version_id].every(v => typeof v === 'string') &&
    (item.knowledge_base_id === undefined || typeof item.knowledge_base_id === 'string') &&
    (item.heading === undefined || Array.isArray(item.heading) && item.heading.every(v => typeof v === 'string')) &&
    (item.page === undefined || typeof item.page === 'number' && Number.isSafeInteger(item.page) && item.page > 0) &&
    (item.kind === undefined ? item.url === undefined :
      (item.kind === 'web_search' || item.kind === 'web_fetch') && !!safeWebSourceURL(item.url))
}

/** url 来自引用投影，链接出口再次检查协议和用户信息。 */
export function safeWebSourceURL(url: unknown): string | undefined {
  if (typeof url !== 'string' || url.length > 2048) return
  try {
    const parsed = new URL(url)
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href
  } catch { /* 无效地址只显示标题。 */ }
}

/** attachment 来自终态事件或历史，检查同源下载需要的标识和元数据。 */
export function isAgentArtifact(attachment: unknown): attachment is AgentArtifact {
  if (!attachment || typeof attachment !== 'object') return false
  const item = attachment as Record<string, unknown>
  return typeof item.asset_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.asset_id) &&
    typeof item.name === 'string' && item.name.length > 0 && typeof item.media_type === 'string' &&
    typeof item.byte_size === 'number' && Number.isSafeInteger(item.byte_size) && item.byte_size > 0 && item.byte_size <= 10 * 1024 * 1024 &&
    typeof item.expires_at === 'string' && Number.isFinite(Date.parse(item.expires_at))
}
