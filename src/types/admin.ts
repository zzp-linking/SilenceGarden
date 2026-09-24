import type { UserRole } from '@/types/auth'

/** 后台用户公开 ID，品牌类型用于避免与其他字符串 ID 混用。 */
export type AdminUserId = string & { readonly __brand: 'AdminUserId' }

/** 单个账号覆盖全局默认值的额度配置。 */
export interface QuotaOverride {
  /** 该账号每天最多可完成的回答轮数。 */
  daily_round_limit?: number
  /** 该账号每天最多可消费的金额，单位为微元。 */
  daily_cost_limit_micro_cny?: number
  /** 该账号允许同时运行的生成任务数。 */
  max_concurrent_runs?: number
}

/** 后台用户列表和命令响应使用的账号摘要。 */
export interface AdminUserSummary {
  /** 用户公开 ID。 */
  id: AdminUserId
  /** 用户登录账号。 */
  account: string
  /** 用户权限角色。 */
  role: UserRole
  /** 账号是否允许登录和使用服务。 */
  status: 'active' | 'disabled'
  /** 账号过期时间；缺省表示不设置过期时间。 */
  expires_at?: string
  /** 用户下次登录后是否必须修改密码。 */
  must_change_password: boolean
  /** 该账号独有的额度覆盖项。 */
  quota_override?: QuotaOverride
  /** 用户记录的乐观并发控制修订号。 */
  revision: number
}

/** 单个用户在指定日期的 AI 用量汇总。 */
export interface UserDailyUsage {
  /** 当天完成或计费的回答轮数。 */
  answer_rounds: number
  /** 按用途分类的 token 用量。 */
  tokens: {
    /** 命中提供商缓存的输入 token 数。 */
    input_cache_hit: number
    /** 未命中提供商缓存的输入 token 数。 */
    input_cache_miss: number
    /** 回答正文消耗的输出 token 数。 */
    output: number
    /** 模型思考过程消耗的 token 数。 */
    reasoning: number
  }
  /** 当天实际产生的费用，单位为微元。 */
  actual_micro_cny: number
}

/** 后台用户行及其当日用量。 */
export interface AdminUserListItem {
  /** 用户账号摘要。 */
  user: AdminUserSummary
  /** 该用户在查询日期的用量。 */
  usage: UserDailyUsage
}

/** 后台用户列表的游标分页结果。 */
export interface AdminUserPage {
  /** 用量统计对应的日期。 */
  date: string
  /** 当前页用户及用量列表。 */
  users: AdminUserListItem[]
  /** 下一页游标；缺省表示没有下一页。 */
  next_cursor?: string
}

/** 后台总览页展示的全局 AI 用量和运行状态。 */
export interface AdminUsage {
  /** 当前统计日期。 */
  date: string
  /** 全部身份合计的当日用量。 */
  global: {
    /** 全局已完成或计费的回答轮数。 */
    answer_rounds: number
    /** 按调用用途统计的模型请求次数。 */
    calls: {
      /** 生成回答的调用次数。 */
      answer: number
      /** 内容审核的调用次数。 */
      moderation: number
      /** 自动生成对话标题的调用次数。 */
      title: number
      /** 历史上下文摘要的调用次数。 */
      summary: number
    }
    /** 全局按用途分类的 token 用量。 */
    tokens: UserDailyUsage['tokens']
    /** 全局实际费用，单位为微元。 */
    actual_micro_cny: number
    /** 使用赠送执行额度的回答轮数。 */
    execution_credit_rounds: number
    /** 已消费的赠送执行额度，单位为微元。 */
    execution_credit_micro_cny: number
    /** 当日失败任务数量。 */
    failure_count: number
    /** 最近一次失败的稳定错误码。 */
    last_failure_code?: string
    /** 该汇总最后更新时间。 */
    updated_at: string
  }
  /** 当前尚未结算的额度预留数量。 */
  active_reservations: number
  /** 当前处于非终态的 Run 数量。 */
  active_runs: number
  /** AI 依赖和服务的就绪检查结果。 */
  readiness: {
    /** 所有必要依赖是否已经就绪。 */
    ready: boolean
    /** 未通过检查的依赖或检查项名称。 */
    failed?: string[]
  }
  /** SSE、持久化、恢复和终态处理的运行诊断指标。 */
  stream: StreamDiagnostics
}

/** AI 流式链路的累计诊断指标。 */
export interface StreamDiagnostics {
  /** 当前打开的 SSE 连接数。 */
  current_connections: number
  /** 进程启动后累计建立的 SSE 连接数。 */
  total_connections: number
  /** 客户端断线后重新连接的累计次数。 */
  reconnects: number
  /** 因历史缺口而从序号零回放的次数。 */
  replay_from_zero: number
  /** 服务端收到的事件回放请求数。 */
  replay_requests: number
  /** 回放请求累计返回的事件数量。 */
  replayed_events: number
  /** 因消费过慢而主动断开的连接数。 */
  slow_connection_disconnects: number
  /** 所有回放请求累计耗时，单位毫秒。 */
  replay_duration_total_ms: number
  /** 单次回放请求最大耗时，单位毫秒。 */
  replay_duration_max_ms: number
  /** 向 Redis 追加流事件的请求次数。 */
  redis_append_requests: number
  /** Redis 事件追加成功次数。 */
  redis_append_successes: number
  /** Redis 事件追加失败次数。 */
  redis_append_failures: number
  /** 成功追加到 Redis 的事件总数。 */
  redis_appended_events: number
  /** 成功追加到 Redis 的事件总字节数。 */
  redis_appended_bytes: number
  /** Redis 追加操作累计耗时，单位毫秒。 */
  redis_append_duration_total_ms: number
  /** 单次 Redis 追加操作最大耗时，单位毫秒。 */
  redis_append_duration_max_ms: number
  /** 检测到重复事件 ID 的次数。 */
  event_id_conflicts: number
  /** 检测到公开事件序号冲突的次数。 */
  public_sequence_conflicts: number
  /** 检测到公开事件序号缺口的次数。 */
  public_sequence_gaps: number
  /** 因流式处理容量耗尽而拒绝任务的次数。 */
  capacity_exceeded: number
  /** 请求执行 Run 终态落库的次数。 */
  finalization_requests: number
  /** Run 终态处理成功次数。 */
  finalization_successes: number
  /** Run 终态处理失败次数。 */
  finalization_failures: number
  /** Run 终态处理累计耗时，单位毫秒。 */
  finalization_duration_total_ms: number
  /** 单次 Run 终态处理最大耗时，单位毫秒。 */
  finalization_duration_max_ms: number
  /** 组装终态数据失败的次数。 */
  finalization_assemble_failures: number
  /** 结算费用或额度失败的次数。 */
  finalization_settle_failures: number
  /** 提交消息终态失败的次数。 */
  finalization_message_failures: number
  /** 提交 Run 终态失败的次数。 */
  finalization_run_failures: number
  /** 写入终态事件失败的次数。 */
  finalization_event_failures: number
  /** 通知订阅者终态失败的次数。 */
  finalization_notify_failures: number
  /** 设置流事件保留期限失败的次数。 */
  finalization_retention_failures: number
  /** 向 MongoDB 提交消息状态的请求次数。 */
  mongo_message_commit_requests: number
  /** MongoDB 消息提交失败次数。 */
  mongo_message_commit_failures: number
  /** MongoDB 消息提交累计耗时，单位毫秒。 */
  mongo_message_commit_duration_total_ms: number
  /** 单次 MongoDB 消息提交最大耗时，单位毫秒。 */
  mongo_message_commit_duration_max_ms: number
  /** 向 MongoDB 提交 Run 状态的请求次数。 */
  mongo_run_commit_requests: number
  /** MongoDB Run 提交失败次数。 */
  mongo_run_commit_failures: number
  /** MongoDB Run 提交累计耗时，单位毫秒。 */
  mongo_run_commit_duration_total_ms: number
  /** 单次 MongoDB Run 提交最大耗时，单位毫秒。 */
  mongo_run_commit_duration_max_ms: number
  /** 后台执行异常 Run 恢复扫描的次数。 */
  recovery_sweeps: number
  /** 恢复扫描发现的候选 Run 数量。 */
  recovery_candidates: number
  /** 成功恢复并完成处理的 Run 数量。 */
  recovery_recovered: number
  /** 恢复处理失败的 Run 数量。 */
  recovery_failed: number
  /** 被恢复为 interrupted 终态的 Run 数量。 */
  recovery_interrupted: number
  /** 因事件数据丢失而无法完整恢复的 Run 数量。 */
  recovery_data_lost: number
  /** 当前等待终态处理的 Run 数量。 */
  pending_finalizations: number
  /** 最早一条待处理终态的等待时长，单位毫秒。 */
  oldest_pending_age_ms: number
  /** 用户请求停止 Run 的累计次数。 */
  stop_requests: number
  /** 停止 Run 成功次数。 */
  stop_successes: number
  /** 停止 Run 失败次数。 */
  stop_failures: number
  /** Run 停止后仍尝试写入事件而被拒绝的次数。 */
  post_stop_event_rejections: number
  /** 已记录首段回答文本延迟的 Run 数量。 */
  first_text_events: number
  /** 首段回答文本延迟累计值，单位毫秒。 */
  first_text_latency_total_ms: number
  /** 首段回答文本最大延迟，单位毫秒。 */
  first_text_latency_max_ms: number
}

/** 某一配额作用域的限制设置。 */
export interface ScopeQuota {
  /** 每日费用上限，单位微元。 */
  daily_micro_cny: number
  /** 每日回答轮数上限。 */
  daily_rounds: number
  /** 同时运行的任务数上限。 */
  max_concurrent: number
  /** 每分钟允许创建的请求数。 */
  requests_per_minute: number
}

/** 后台可编辑的全局 AI 设置。 */
export interface AiSettings {
  /** 配置文档 ID，当前固定为 global。 */
  id: 'global'
  /** 配置的乐观并发控制修订号。 */
  revision: number
  /** 最后修改配置的管理员 ID。 */
  updated_by: string
  /** 配置最后更新时间。 */
  updated_at: string
  /** AI 服务开关和维护提示。 */
  service: {
    /** 是否允许创建新的 AI 生成任务。 */
    enabled: boolean
    /** 服务关闭时向用户展示的提示。 */
    maintenance_message: string
  }
  /** 不同身份作用域使用的配额。 */
  quotas: {
    /** 全站共享的总额度。 */
    global: ScopeQuota
    /** 未单独覆盖时登录账号使用的默认额度。 */
    account_default: ScopeQuota
    /** 匿名访问按 IP 限制的额度。 */
    anonymous_ip: ScopeQuota
    /** 匿名访问按设备限制的额度。 */
    anonymous_device: ScopeQuota
  }
  /** 输入、上下文、输出、执行时间和图片限制。 */
  limits: {
    /** 登录用户单次输入最大字符数。 */
    login_text_chars: number
    /** 匿名用户单次输入最大字符数。 */
    anonymous_text_chars: number
    /** 构造模型上下文时的目标 token 数。 */
    context_target_tokens: number
    /** 超过该 token 数后触发历史摘要。 */
    summary_trigger_tokens: number
    /** 构造上下文时始终保留的最近消息数。 */
    recent_messages: number
    /** 单次回答允许生成的最大 token 数。 */
    max_output_tokens: number
    /** 单个 Run 的超时时间，单位秒。 */
    run_timeout_seconds: number
    /** 单张图片最大字节数。 */
    image_max_bytes: number
    /** 单张图片最大像素总数。 */
    image_max_pixels: number
    /** 允许同时处理的图片任务数。 */
    image_concurrent: number
    /** 允许上传的图片 MIME 类型。 */
    allowed_image_mimes: string[]
  }
  /** 图片理解功能设置。 */
  images: {
    /** 是否允许在提问中上传图片。 */
    enabled: boolean
  }
  /** 各 AI 阶段使用的模型配置。 */
  models: {
    /** 文本回答模型名称。 */
    answer: string
    /** 图片理解模型名称。 */
    vision: string
    /** 内容审核模型名称。 */
    moderation: string
    /** 自动标题模型名称。 */
    title: string
    /** 历史摘要模型名称。 */
    summary: string
    /** 管理员可选用的模型白名单。 */
    allowlist: string[]
  }
  /** 费用换算和各模型峰值单价。 */
  pricing: {
    /** 当前计价规则版本。 */
    version: number
    /** 该计价版本开始生效的时间。 */
    effective_at: string
    /** 外币换算人民币使用的百万分比率。 */
    exchange_rate_micros: number
    /** 防止价格波动而增加的百万分安全余量。 */
    safety_margin_micros: number
    /** 按模型名称索引的峰值 token 单价。 */
    models: Record<string, {
      /** 每百万缓存命中输入 token 的峰值费用，单位微元。 */
      input_cache_hit_peak_micro_cny_per_million: number
      /** 每百万未命中输入 token 的峰值费用，单位微元。 */
      input_cache_miss_peak_micro_cny_per_million: number
      /** 每百万输出 token 的峰值费用，单位微元。 */
      output_peak_micro_cny_per_million: number
    }>
  }
  /** 内容审核规则配置。 */
  moderation: {
    /** 当前启用的审核规则版本。 */
    rule_version: string
  }
  /** 后台诊断数据的保留期限。 */
  retention: {
    /** 失败日志保留天数。 */
    failure_log_days: number
    /** 管理操作审计日志保留天数。 */
    audit_log_days: number
  }
  /** AI 空会话页固定展示的四条推荐问题。 */
  starters: [string, string, string, string]
}

/** 后台查询的一次 AI Run 失败记录。 */
export interface FailureLog {
  /** 站内请求追踪 ID。 */
  request_id: string
  /** 失败 Run 的公开 ID。 */
  run_id: string
  /** 发起任务的是登录用户还是匿名访客。 */
  identity_type: 'user' | 'anonymous'
  /** 用户、IP 或设备等计费身份 ID。 */
  identity_id?: string
  /** 失败发生的处理阶段。 */
  stage: string
  /** 失败调用使用的模型名称。 */
  model: string
  /** 上游或本站返回的 HTTP 状态码。 */
  http_status: number
  /** 稳定错误码。 */
  error_code: string
  /** 该错误是否允许重试。 */
  retryable: boolean
  /** 从请求开始到首个 token 的耗时，单位毫秒。 */
  first_token_latency_ms: number
  /** 请求总耗时，单位毫秒。 */
  duration_ms: number
  /** 用户输入文本字符数。 */
  input_chars: number
  /** 请求是否包含图片。 */
  had_image: boolean
  /** 上游是否缺少可靠的 token 用量。 */
  usage_missing: boolean
  /** AI 提供商返回的请求追踪 ID。 */
  provider_request_id?: string
  /** 失败日志创建时间。 */
  created_at: string
}

/** 审计日志中一个字段值的带类型表示。 */
interface AuditValue {
  /** 值的数据种类，用于选择对应的可选字段。 */
  kind: string
  /** 字符串值。 */
  text?: string
  /** 数值。 */
  number?: number
  /** 布尔值。 */
  bool?: boolean
  /** 时间值。 */
  time?: string
}

/** 管理员执行敏感操作时记录的审计日志。 */
export interface AuditLog {
  /** 执行操作的管理员用户 ID。 */
  admin_user_id: string
  /** 被执行的管理操作名称。 */
  action: string
  /** 操作目标的资源类型。 */
  target_type: string
  /** 操作目标的资源 ID。 */
  target_id?: string
  /** 对应 HTTP 请求的追踪 ID。 */
  request_id: string
  /** 本次操作修改的字段列表。 */
  changes?: Array<{
    /** 被修改字段的路径或名称。 */
    field: string
    /** 修改前的字段值。 */
    before: AuditValue
    /** 修改后的字段值。 */
    after: AuditValue
  }>
  /** 审计日志创建时间。 */
  created_at: string
}

/** 后台元数据列表的通用游标分页结果。 */
export interface MetadataPage<T> {
  /** 当前页的数据项。 */
  items: T[]
  /** 下一页游标；缺省表示没有下一页。 */
  next_cursor?: string
}

/** 创建、更新或重置用户后的响应。 */
export interface UserCommandResponse {
  /** 命令执行后的最新用户摘要。 */
  user: AdminUserSummary
  /** 仅创建或重置密码时一次性返回的临时密码。 */
  temporary_password?: string
}

/** 异步删除用户数据任务的状态。 */
export interface DeletionJob {
  /** 删除任务 ID。 */
  job_id: string
  /** 被删除数据所属的用户 ID。 */
  user_id: string
  /** 发起删除请求的管理员 ID。 */
  requested_by: string
  /** 创建任务的 HTTP 请求追踪 ID。 */
  request_id: string
  /** 删除任务当前生命周期状态。 */
  state: 'queued' | 'running' | 'failed' | 'completed'
  /** 删除流程当前执行阶段。 */
  stage: string
  /** 任务失败时的稳定错误码。 */
  error_code?: string
  /** 删除任务记录的修订号。 */
  revision: number
  /** 删除任务创建时间。 */
  created_at: string
  /** 删除任务最后更新时间。 */
  updated_at: string
  /** 删除任务完成时间。 */
  completed_at?: string
}
