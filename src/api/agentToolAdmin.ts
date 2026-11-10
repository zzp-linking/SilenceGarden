import { clientV2 } from '@/api/clientV2'

/** 知识检索工具共享的助手授权策略。 */
export interface KnowledgeScope {
  mode: 'selected' | 'all' // 指定授权或所有有效知识库。
  knowledge_base_ids: string[] // 指定模式的授权 UUID，全量模式为空。
}

/** 工具配置只包含后台操作所需的公开状态。 */
export interface AgentToolConfig {
  knowledge_scope?: KnowledgeScope // 仅知识库检索配置提供。
  name: string // 工具的稳定模型名称。
  label: string // 后台显示名称。
  enabled: boolean // 保存的管理员开关。
  ready: boolean // 当前依赖是否就绪。
  revision: number // 下次修改的期望修订。
  reason?: string // 依赖未就绪的公开说明。
  has_api_key?: boolean // 仅表示已加密保存凭据。
  credential_available?: boolean // 当前部署能否解密凭据。
}

/** 修改可独立提交开关和授权，服务端按同一修订更新。 */
interface ToolUpdate {
  enabled?: boolean // 缺省保留当前开关。
  knowledge_scope?: KnowledgeScope // 缺省保留当前授权。
  credential_action?: 'replace' | 'clear' // 缺省保留已保存的密钥。
  api_key?: string // 仅替换时提交的写入值。
}

/** 后台支持的策略键及对应的完整 JSON 值。 */
export interface ToolPolicyValues {
  'tool.web_search.quota': { per_user_daily: number; site_daily: number } // 北京时间每日的个人和站点额度。
  'tool.assets.retention': { download_hours: number; export_hours: number } // 下载和导出保留小时数。
}

/** 每条策略使用其独立修订控制并发写入。 */
export type ToolPolicy<K extends keyof ToolPolicyValues = keyof ToolPolicyValues> = {
  key: K // 已注册的策略键。
  value: ToolPolicyValues[K] // 与策略键匹配的完整值。
  revision: number // 当前已提交修订。
}

/** 检查服务端返回的授权模式和规范知识库 ID。 */
function isScope(value: unknown): value is KnowledgeScope {
  if (!value || typeof value !== 'object') return false
  const scope = value as Record<string, unknown>
  const ids = scope.knowledge_base_ids
  return (scope.mode === 'selected' || scope.mode === 'all') && Array.isArray(ids) &&
    ids.length <= 50 && (scope.mode === 'selected' || ids.length === 0) &&
    ids.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
}

/** 校验工具配置回包，拒绝错误或缺少修订的响应。 */
function isConfig(value: unknown): value is AgentToolConfig {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.name === 'string' && typeof row.label === 'string' &&
    typeof row.enabled === 'boolean' && typeof row.ready === 'boolean' &&
    typeof row.revision === 'number' && Number.isSafeInteger(row.revision) && row.revision >= 1 &&
    (row.reason === undefined || typeof row.reason === 'string') &&
    (row.has_api_key === undefined || typeof row.has_api_key === 'boolean') &&
    (row.credential_available === undefined || typeof row.credential_available === 'boolean') &&
    (row.knowledge_scope === undefined || isScope(row.knowledge_scope))
}

/** 工具列表支持只读取消，更新复用同源会话且禁用自动重放。 */
export const agentToolAdmin = {
  /** signal 仅取消当前列表读取。 */
  async list(signal: AbortSignal): Promise<AgentToolConfig[]> {
    const data = await clientV2.request<{ items?: unknown }>('/admin/agent/tools', { signal })
    if (!Array.isArray(data.items) || !data.items.every(isConfig)) throw new Error('工具配置响应格式不正确')
    return data.items
  },
  /** config 是待更新的已读快照，change 为本次修改项。 */
  async update(config: AgentToolConfig, change: ToolUpdate): Promise<AgentToolConfig> {
    const result = await clientV2.request<unknown>(`/admin/agent/tools/${encodeURIComponent(config.name)}`, {
      method: 'PATCH', body: JSON.stringify({ revision: config.revision, ...change })
    }, false)
    if (!isConfig(result) || result.name !== config.name) throw new Error('工具配置响应格式不正确')
    return result
  },
  /** 读取搜索额度与文件保留期。 */
  async policies(signal: AbortSignal): Promise<ToolPolicy[]> {
    const data = await clientV2.request<{ items: ToolPolicy[] }>('/admin/agent/settings', { signal })
    return data.items
  },
  /** 使用 policy 的已读修订保存对应的完整值。 */
  async updatePolicy<K extends keyof ToolPolicyValues>(policy: ToolPolicy<K>, value: ToolPolicyValues[K]): Promise<ToolPolicy<K>> {
    return clientV2.request<ToolPolicy<K>>(`/admin/agent/settings/${policy.key}`, {
      method: 'PATCH', body: JSON.stringify({ revision: policy.revision, value })
    }, false)
  }
}
