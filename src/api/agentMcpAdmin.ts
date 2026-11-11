import { clientV2 } from './clientV2'

export type McpAuthMode = 'none' | 'bearer' | 'header' | 'query' // 由后端注入的认证方式。
export type McpCredentialAction = 'keep' | 'replace' | 'clear' // 凭据只写操作。

/** 单行查询参数的安全读取投影。 */
export interface McpQueryParam {
  name: string // 区分大小写的参数名。
  secret?: boolean // 保密项没有 value。
  value?: string // 普通参数值，允许空字符串。
  has_credential?: boolean // 仅保密项返回是否有已保存的值。
}

/** 单行查询参数写入，保密值仅随 replace 提交。 */
export type McpQueryChange = { name: string; value: string } |
  ({ name: string; secret: true } & McpCredentialChange)

/** 可复用的仅写凭据字段。 */
export interface McpCredentialChange {
  credential_action?: McpCredentialAction // 默认保留当前字段。
  credential?: string // 仅 replace 携带，响应永远缺省。
}

/** MCP 服务的安全管理快照。 */
export interface McpService {
  id: string // 服务 UUID。
  service_key: string // 不可变命名空间。
  display_name: string // 管理页显示名称。
  transport: 'streamable_http' // 本期传输方式。
  endpoint: string // 基础地址，查询参数另存。
  auth_mode: McpAuthMode // 服务级身份注入方式。
  auth_name?: string // 自定义认证头名。
  query_params: McpQueryParam[] // 不含保密值的参数列表。
  timeout_ms: number // 工具调用超时。
  enabled: boolean // 服务后台开关。
  revision: number // 写入操作共享的 CAS 修订。
  connection_revision: number // 连接配置修订。
  discovered_connection_revision: number // 最近成功发现时的连接修订。
  discovered_at?: string // 最近成功发现时间。
  protocol_version?: string // 最近成功协商的版本。
  discovery_error?: string // 最近失败的安全诊断码。
  has_credential: boolean // Bearer 或自定义头已有凭据。
}

/** 服务表单保存的配置。 */
export interface McpServiceChange extends McpCredentialChange {
  service_key?: string // 仅新增时提交。
  display_name: string // 管理页显示名称。
  transport: 'streamable_http' // 本期传输方式。
  endpoint: string // 不含查询参数的基础地址。
  auth_mode: McpAuthMode // 服务级认证方式。
  auth_name?: string // 自定义认证头。
  query_params: McpQueryChange[] // 本次提交的完整查询参数列表。
  timeout_ms: number // 工具调用超时。
}

/** 当前已发布的远端目录及逐工具授权。 */
export interface McpTool {
  id: string // 目录条目 UUID。
  raw_name: string // 远端工具名。
  model_name: string // 冻结后交给模型的稳定名称。
  description: string // 供应商工具描述，已限制大小。
  input_schema: unknown // 仅作为文本查看的输入 Schema。
  status: 'available' | 'missing' | 'incompatible' // 当前目录兼容状态。
  approved: boolean // 当前目录签名已获管理员授权。
}

/** 目录操作返回其所属服务修订。 */
interface McpDirectory {
  revision: number // 与服务 CAS 共享。
  items: McpTool[] // 按模型名称排序的目录。
}

const prefix = '/admin/agent/mcp/services' // clientV2 负责 API 根路径和会话。

/** serviceID 为已读取的服务 UUID。 */
function path(serviceID: string) { return `${prefix}/${encodeURIComponent(serviceID)}` }

/** 管理写入使用现有同源会话，禁用认证刷新自动重放。 */
function write<T>(url: string, method: 'POST' | 'PATCH', data: object) {
  return clientV2.request<T>(url, { method, body: JSON.stringify(data) }, false)
}

/** MCP 管理 API，所有凭据仅由编辑器当前保存请求传入。 */
export const agentMcpAdmin = {
  /** signal 仅取消读取。 */
  list: (signal: AbortSignal) => clientV2.request<{ items: McpService[] }>(prefix, { signal }),
  /** id 为服务 UUID。 */
  get: (id: string, signal: AbortSignal) => clientV2.request<McpService>(path(id), { signal }),
  /** change 来自当前连接表单。 */
  create: (change: McpServiceChange) => write<McpService>(prefix, 'POST', change),
  /** service 提供当前 UUID 及期望修订。 */
  save: (service: McpService, change: McpServiceChange) => write<McpService>(path(service.id), 'PATCH', { ...change, revision: service.revision }),
  /** enabled 是独立的启停意图。 */
  enable: (service: McpService, enabled: boolean) => write<McpService>(path(service.id), 'PATCH', { enabled, revision: service.revision }),
  /** 使用已保存服务及其修订测试，成功发布完整目录。 */
  discover: (service: McpService) => write<McpDirectory & { service: McpService }>(`${path(service.id)}/discover`, 'POST', { revision: service.revision }),
  /** 同时读取目录与其对应的服务修订。 */
  tools: (id: string, signal: AbortSignal) => clientV2.request<McpDirectory>(`${path(id)}/tools`, { signal }),
  /** toolID 和 approved 指定当前目录的逐工具授权。 */
  approve: (service: McpService, toolID: string, approved: boolean) =>
    write<{ tool: McpTool; revision: number }>(`${path(service.id)}/tools/${encodeURIComponent(toolID)}`, 'PATCH', { approved, revision: service.revision })
}
