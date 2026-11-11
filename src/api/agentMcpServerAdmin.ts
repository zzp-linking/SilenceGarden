import { clientV2, V2HttpError } from '@/api/clientV2'

/** 对外服务的数据库设置与当前实例的运行状态。 */
export interface McpServerService {
  service_key: string // 稳定服务标识。
  display_name: string // 后台展示名。
  description: string // 对外能力说明。
  enabled: boolean // 管理员设置的启停状态。
  timeout_ms: number // 检索超时毫秒数。
  max_concurrency: number // 跨实例检索并发。
  revision: number // 提交修改时携带的修订号。
  available: boolean // 目录与配额依赖是否可用。
  retrieval_available: boolean // 语义检索依赖是否就绪。
}

/** 服务清单和当前后端实例的协议装配状态。 */
interface McpServiceList {
  items: McpServerService[] // 已注册的对外服务。
  protocol_available?: boolean // 旧版管理接口可能尚未返回此状态。
}

/** 创建或维护 Key 的可编辑属性。 */
export interface McpKeyFields {
  title: string // 发钥标题。
  consumer_label: string | null // 合作方，空值表示清除。
  note: string | null // 管理备注，空值表示清除。
  expires_at: string | null // RFC 3339 到期时间。
  requests_per_minute: number | null // 独立分钟额度，空值继承部署配置。
}

/** 后台可重复读取的 Key 元数据。 */
export interface McpServerKey extends McpKeyFields {
  id: string // Key 的公开 UUIDv7 标识。
  key_hint: string // 可展示掩码。
  service_keys: string[] // 已显式授予的服务键。
  grant_count: number // 当前授权数。
  status: 'active' | 'expired' | 'revoked' // 当前有效状态。
  revision: number // Key 管理修订号。
  last_used_at: string | null // 最近一次接纳工具调用的时间。
  created_at: string // 发钥时间。
  rotated_from_key_id: string | null // 轮换来源。
  revoked_at: string | null // 撤销时间。
  revocation_reason: string | null // 管理员填写的撤销原因。
}

/** 发钥成功时短暂出现的一次性明文。 */
export interface McpIssuedKey {
  key: McpServerKey // 发钥后的安全元数据。
  api_key: string // 仅在创建成功的响应提供。
}

/** 可筛选的对外工具调用摘要。 */
export interface McpCallLog {
  id: string // 调用明细 UUIDv7。
  request_id: string // 服务端关联请求 ID。
  api_key_id: string // 调用 Key 的标识。
  key_title: string // 当前 Key 标题。
  service_name: string // 当前服务名称。
  tool_name: string // 工具名。
  knowledge_base_id: string | null // 检索目标库。
  started_at: string // 开始时间。
  duration_ms: number // 执行耗时。
  status: 'succeeded' | 'failed' | 'rejected' | 'timed_out' | 'canceled' // 调用结局。
  error_code: string | null // 公开错误码。
  result_count: number | null // 成功结果条数。
}

/** 支持继续读取的稳定游标页。 */
export interface McpCursorPage<T> {
  items: T[] // 当前页数据。
  next_cursor?: string // 读取下一页的续页标识。
}

/** clientV2 负责部署前缀、会话和 V2 错误信封。 */
const prefix = '/admin/agent/mcp-server'

/** 编码当前查询快照，保留已发出的游标。 */
function query(params: Record<string, string | undefined>) {
  const result = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) result.set(key, value)
  }
  return result.size ? `?${result}` : ''
}

/** 管理写入关闭自动重放，避免创建操作重复发钥。 */
function write<T>(path: string, method: 'POST' | 'PATCH' | 'PUT', body: object) {
  return clientV2.request<T>(prefix + path, { method, body: JSON.stringify(body) }, false)
}

/** Key 详情路径编码公开标识，复用于三种修改命令。 */
function keyPath(id: string) {
  return `/api-keys/${encodeURIComponent(id)}`
}

/** 页面调用的对外 MCP 管理接口。 */
export const mcpServerAdmin = {
  /** 读取代码注册服务和当前可用性。 */
  services: (signal?: AbortSignal) => clientV2.request<McpServiceList>(prefix + '/services', { signal }),
  /** 以原修订号提交服务启停及限制。 */
  saveService: (key: string, value: Pick<McpServerService, 'revision' | 'timeout_ms' | 'max_concurrency'> & { enabled?: boolean }) =>
    write<McpServerService>(`/services/${encodeURIComponent(key)}`, 'PATCH', value),
  /** 按当前筛选条件读取 Key 游标页。 */
  keys: (params: Record<string, string | undefined>, signal: AbortSignal) =>
    clientV2.request<McpCursorPage<McpServerKey>>(prefix + '/api-keys' + query(params), { signal }),
  /** 读最新属性、授权和修订，供管理弹窗编辑。 */
  key: (id: string, signal: AbortSignal) => clientV2.request<McpServerKey>(prefix + keyPath(id), { signal }),
  /** 创建时可选指定被轮换的历史 Key。 */
  issue: (fields: McpKeyFields, oldKey?: string) =>
    write<McpIssuedKey>('/api-keys', 'POST', { ...fields, rotated_from_key_id: oldKey }),
  /** 保存最新读取修订上的 Key 属性。 */
  saveKey: (key: McpServerKey, fields: McpKeyFields) =>
    write<McpServerKey>(keyPath(key.id), 'PATCH', { ...fields, revision: key.revision }),
  /** 完整保存服务授权集合，并附可选的授权备注。 */
  grants: (key: McpServerKey, serviceKeys: string[], note: string | null) =>
    write<McpServerKey>(keyPath(key.id) + '/grants', 'PUT', { service_keys: serviceKeys, note, revision: key.revision }),
  /** 撤销指定凭据并保留其历史。 */
  revoke: (key: McpServerKey, reason: string | null) =>
    write<McpServerKey>(keyPath(key.id) + '/revoke', 'POST', { reason, revision: key.revision }),
  /** 读取组合筛选的调用记录。 */
  logs: (params: Record<string, string | undefined>, signal: AbortSignal) =>
    clientV2.request<McpCursorPage<McpCallLog>>(prefix + '/call-logs' + query(params), { signal }),
}

/** 将修订冲突提示为可操作的刷新指引。 */
export function mcpServerError(reason: unknown) {
  if (reason instanceof V2HttpError && reason.status === 409) return '设置已变更，请关闭弹窗并重新读取后再保存。'
  return reason instanceof Error ? reason.message : '操作失败，请稍后重试。'
}

