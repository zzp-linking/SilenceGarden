import { ClientV2, clientV2 } from '@/api/clientV2'
import type {
  AdminUsage,
  AdminUserId,
  AdminUserListItem,
  AdminUserPage,
  AdminUserSummary,
  AiSettings,
  AuditLog,
  DeletionJob,
  FailureLog,
  MetadataPage,
  QuotaOverride
} from '@/types/admin'

export interface PageOptions {
  cursor?: string
  limit?: number
}

export interface CreateUserInput {
  account: string
  expires_at?: string
  quota_override?: QuotaOverride
}

export interface UserPatchInput {
  status?: 'active' | 'disabled'
  expires_at?: string
  clear_expires?: boolean
  quota_override?: QuotaOverride
  clear_quota?: boolean
}

export interface UserCommandResponse {
  user: AdminUserSummary
  temporary_password?: string
}

export interface AdminApi {
  usage(): Promise<AdminUsage>
  users(options?: PageOptions): Promise<AdminUserPage>
  createUser(input: CreateUserInput): Promise<UserCommandResponse>
  updateUser(id: AdminUserId, revision: number, patch: UserPatchInput): Promise<UserCommandResponse>
  resetPassword(id: AdminUserId, revision: number): Promise<UserCommandResponse>
  deleteUser(id: AdminUserId): Promise<DeletionJob>
  resetQuota(id: AdminUserId): Promise<void>
  settings(): Promise<AiSettings>
  updateSettings(revision: number, settings: AiSettings): Promise<AiSettings>
  enable(revision: number): Promise<void>
  disable(revision: number, message: string): Promise<void>
  failures(options?: PageOptions): Promise<MetadataPage<FailureLog>>
  auditLogs(options?: PageOptions): Promise<MetadataPage<AuditLog>>
}

type Guard<T> = (value: unknown) => value is T

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isScopeQuota(value: unknown): boolean {
  if (!isRecord(value)) return false
  return isNumber(value.daily_micro_cny) && isNumber(value.daily_rounds)
    && isNumber(value.max_concurrent) && isNumber(value.requests_per_minute)
}

function isAdminUser(value: unknown): value is AdminUserSummary {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.account === 'string'
    && (value.role === 'admin' || value.role === 'demo_user')
    && (value.status === 'active' || value.status === 'disabled')
    && typeof value.must_change_password === 'boolean' && isNumber(value.revision)
}

function isUserPage(value: unknown): value is AdminUserPage {
  if (!isRecord(value) || typeof value.date !== 'string' || !Array.isArray(value.users)) return false
  return value.users.every(item => isRecord(item) && isAdminUser(item.user) && isUserUsage(item.usage))
}

function isUserUsage(value: unknown): boolean {
  if (!isRecord(value) || !isNumber(value.answer_rounds) || !isNumber(value.actual_micro_cny) || !isRecord(value.tokens)) return false
  const tokens = value.tokens
  return ['input_cache_hit', 'input_cache_miss', 'output', 'reasoning'].every(key => isNumber(tokens[key]))
}

function isAdminUsage(value: unknown): value is AdminUsage {
  if (!isRecord(value) || typeof value.date !== 'string' || !isRecord(value.global) || !isNumber(value.active_reservations) || !isNumber(value.active_runs) || !isRecord(value.readiness)) return false
  const global = value.global
  const readiness = value.readiness
  const calls = isRecord(global.calls) ? global.calls : null
  return isUserUsage({ answer_rounds: global.answer_rounds, actual_micro_cny: global.actual_micro_cny, tokens: global.tokens })
    && calls !== null && ['answer', 'moderation', 'title', 'summary'].every(key => isNumber(calls[key]))
    && isNumber(global.execution_credit_rounds) && isNumber(global.execution_credit_micro_cny)
    && isNumber(global.failure_count) && typeof global.updated_at === 'string'
    && typeof readiness.ready === 'boolean' && (readiness.failed === undefined || isStringArray(readiness.failed))
}

function isModelPrice(value: unknown): boolean {
  return isRecord(value) && isNumber(value.input_cache_hit_peak_micro_cny_per_million)
    && isNumber(value.input_cache_miss_peak_micro_cny_per_million)
    && isNumber(value.output_peak_micro_cny_per_million)
}

function isSettings(value: unknown): value is AiSettings {
  if (!isRecord(value) || value.id !== 'global' || !isNumber(value.revision) || typeof value.updated_by !== 'string' || typeof value.updated_at !== 'string') return false
  if (!isRecord(value.service) || typeof value.service.enabled !== 'boolean' || typeof value.service.maintenance_message !== 'string') return false
  const quotas = value.quotas
  if (!isRecord(quotas) || !['global', 'account_default', 'anonymous_ip', 'anonymous_device'].every(key => isScopeQuota(quotas[key]))) return false
  const limits = value.limits
  if (!isRecord(limits) || !['login_text_chars', 'anonymous_text_chars', 'context_target_tokens', 'summary_trigger_tokens', 'recent_messages', 'max_output_tokens', 'run_timeout_seconds', 'image_max_bytes', 'image_max_pixels', 'image_concurrent'].every(key => isNumber(limits[key])) || !isStringArray(limits.allowed_image_mimes)) return false
  if (!isRecord(value.images) || typeof value.images.enabled !== 'boolean') return false
  const models = value.models
  if (!isRecord(models) || !['answer', 'vision', 'moderation', 'title', 'summary'].every(key => typeof models[key] === 'string') || !isStringArray(models.allowlist)) return false
  if (!isRecord(value.pricing) || !isNumber(value.pricing.version) || !isNumber(value.pricing.exchange_rate_micros) || !isNumber(value.pricing.safety_margin_micros) || typeof value.pricing.effective_at !== 'string' || !isRecord(value.pricing.models) || !Object.values(value.pricing.models).every(isModelPrice)) return false
  if (!isRecord(value.moderation) || typeof value.moderation.rule_version !== 'string') return false
  if (!isRecord(value.retention) || !isNumber(value.retention.failure_log_days) || !isNumber(value.retention.audit_log_days)) return false
  return Array.isArray(value.starters) && value.starters.length === 4 && value.starters.every(item => typeof item === 'string')
}

function isUserCommand(value: unknown): value is UserCommandResponse {
  return isRecord(value) && isAdminUser(value.user) && (value.temporary_password === undefined || typeof value.temporary_password === 'string')
}

function isDeletionJob(value: unknown): value is DeletionJob {
  return isRecord(value) && typeof value.job_id === 'string' && typeof value.user_id === 'string' && typeof value.requested_by === 'string'
    && typeof value.request_id === 'string' && ['queued', 'running', 'failed', 'completed'].includes(String(value.state))
    && typeof value.stage === 'string' && isNumber(value.revision) && typeof value.created_at === 'string' && typeof value.updated_at === 'string'
}

function isFailure(value: unknown): value is FailureLog {
  return isRecord(value) && typeof value.request_id === 'string' && typeof value.run_id === 'string'
    && (value.identity_type === 'user' || value.identity_type === 'anonymous') && typeof value.stage === 'string'
    && typeof value.model === 'string' && isNumber(value.http_status) && typeof value.error_code === 'string'
    && typeof value.retryable === 'boolean' && isNumber(value.first_token_latency_ms) && isNumber(value.duration_ms)
	&& isNumber(value.input_chars) && typeof value.had_image === 'boolean' && typeof value.usage_missing === 'boolean'
	&& (value.provider_request_id === undefined || typeof value.provider_request_id === 'string')
	&& typeof value.created_at === 'string'
}

function isAudit(value: unknown): value is AuditLog {
  return isRecord(value) && typeof value.admin_user_id === 'string' && typeof value.action === 'string'
    && typeof value.target_type === 'string' && typeof value.request_id === 'string' && typeof value.created_at === 'string'
}

function isPage<T>(itemGuard: Guard<T>): Guard<MetadataPage<T>> {
  return (value: unknown): value is MetadataPage<T> => isRecord(value) && Array.isArray(value.items) && value.items.every(itemGuard)
}

async function requestChecked<T>(client: ClientV2, path: string, guard: Guard<T>, init?: RequestInit): Promise<T> {
  const value: unknown = await client.request<unknown>(path, init)
  if (!guard(value)) throw new Error(`管理接口响应结构无效：${path}`)
  return value
}

function pageQuery(options: PageOptions = {}): string {
  const params = new URLSearchParams()
  if (options.cursor) params.set('cursor', options.cursor)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const query = params.toString()
  return query ? `?${query}` : ''
}

function adminUserId(value: string): AdminUserId { return value as AdminUserId }

export class HttpAdminApi implements AdminApi {
  constructor(private readonly client: ClientV2 = clientV2) {}

  usage(): Promise<AdminUsage> { return requestChecked(this.client, '/admin/ai/usage', isAdminUsage) }

  users(options?: PageOptions): Promise<AdminUserPage> { return requestChecked(this.client, `/admin/users${pageQuery(options)}`, isUserPage) }

  createUser(input: CreateUserInput): Promise<UserCommandResponse> {
    return requestChecked(this.client, '/admin/users', isUserCommand, { method: 'POST', body: JSON.stringify(input) })
  }

  updateUser(id: AdminUserId, revision: number, patch: UserPatchInput): Promise<UserCommandResponse> {
    return requestChecked(this.client, `/admin/users/${encodeURIComponent(id)}`, isUserCommand, { method: 'PATCH', body: JSON.stringify({ revision, ...patch }) })
  }

  resetPassword(id: AdminUserId, revision: number): Promise<UserCommandResponse> {
    return requestChecked(this.client, `/admin/users/${encodeURIComponent(id)}/reset-password`, isUserCommand, { method: 'POST', body: JSON.stringify({ revision }) })
  }

  deleteUser(id: AdminUserId): Promise<DeletionJob> {
    return requestChecked(this.client, `/admin/users/${encodeURIComponent(id)}`, isDeletionJob, { method: 'DELETE' })
  }

  async resetQuota(id: AdminUserId): Promise<void> {
    await this.client.request(`/admin/ai/quota/${encodeURIComponent(id)}/reset`, { method: 'POST' })
  }

  settings(): Promise<AiSettings> { return requestChecked(this.client, '/admin/ai/settings', isSettings) }

  updateSettings(revision: number, settings: AiSettings): Promise<AiSettings> {
    return requestChecked(this.client, '/admin/ai/settings', isSettings, { method: 'PATCH', body: JSON.stringify({ revision, settings }) })
  }

  async enable(revision: number): Promise<void> {
    await this.client.request('/admin/ai/service/enable', { method: 'POST', body: JSON.stringify({ revision }) })
  }

  async disable(revision: number, message: string): Promise<void> {
    await this.client.request('/admin/ai/service/disable', { method: 'POST', body: JSON.stringify({ revision, maintenance_message: message }) })
  }

  failures(options?: PageOptions): Promise<MetadataPage<FailureLog>> {
    return requestChecked(this.client, `/admin/ai/failures${pageQuery(options)}`, isPage(isFailure))
  }

  auditLogs(options?: PageOptions): Promise<MetadataPage<AuditLog>> {
    return requestChecked(this.client, `/admin/audit-logs${pageQuery(options)}`, isPage(isAudit))
  }
}

function defaultSettings(): AiSettings {
  const price = { input_cache_hit_peak_micro_cny_per_million: 0, input_cache_miss_peak_micro_cny_per_million: 0, output_peak_micro_cny_per_million: 0 }
  return {
    id: 'global', revision: 1, updated_by: 'mock', updated_at: new Date(0).toISOString(),
    service: { enabled: false, maintenance_message: '静语正在休息，历史仍可查看。' },
    quotas: {
      global: { daily_micro_cny: 5_000_000, daily_rounds: 100, max_concurrent: 5, requests_per_minute: 30 },
      account_default: { daily_micro_cny: 1_000_000, daily_rounds: 30, max_concurrent: 2, requests_per_minute: 10 },
      anonymous_ip: { daily_micro_cny: 300_000, daily_rounds: 5, max_concurrent: 1, requests_per_minute: 3 },
      anonymous_device: { daily_micro_cny: 300_000, daily_rounds: 5, max_concurrent: 1, requests_per_minute: 3 }
    },
    limits: { login_text_chars: 16000, anonymous_text_chars: 4000, context_target_tokens: 65536, summary_trigger_tokens: 48000, recent_messages: 12, max_output_tokens: 16384, run_timeout_seconds: 480, image_max_bytes: 8388608, image_max_pixels: 20000000, image_concurrent: 1, allowed_image_mimes: ['image/jpeg', 'image/png', 'image/webp'] },
    images: { enabled: false },
    models: { answer: 'deepseek-v4-flash', vision: 'deepseek-v4-flash-vision-exp', moderation: 'deepseek-v4-flash', title: 'deepseek-v4-flash', summary: 'deepseek-v4-flash', allowlist: ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'] },
    pricing: { version: 0, effective_at: new Date(0).toISOString(), exchange_rate_micros: 0, safety_margin_micros: 0, models: { 'deepseek-v4-flash': { ...price }, 'deepseek-v4-flash-vision-exp': { ...price } } },
    moderation: { rule_version: 'local-v1' }, retention: { failure_log_days: 30, audit_log_days: 180 },
    starters: ['解释一个复杂概念', '帮我整理思路', '一起阅读一段文字', '从一个问题开始']
  }
}

export class MockAdminApi implements AdminApi {
  private readonly data: AdminUserListItem[] = [{
    user: { id: adminUserId('admin-1'), account: 'admin', role: 'admin', status: 'active', must_change_password: false, revision: 0 },
    usage: { answer_rounds: 0, tokens: { input_cache_hit: 0, input_cache_miss: 0, output: 0, reasoning: 0 }, actual_micro_cny: 0 }
  }, {
    user: { id: adminUserId('demo-1'), account: 'demo_user', role: 'demo_user', status: 'active', must_change_password: false, revision: 0 },
    usage: { answer_rounds: 1, tokens: { input_cache_hit: 0, input_cache_miss: 42, output: 18, reasoning: 8 }, actual_micro_cny: 1200 }
  }]
  private currentSettings = defaultSettings()

  async usage(): Promise<AdminUsage> {
    return { date: '20260907', global: { answer_rounds: 1, calls: { answer: 1, moderation: 0, title: 0, summary: 0 }, tokens: { input_cache_hit: 0, input_cache_miss: 42, output: 18, reasoning: 8 }, actual_micro_cny: 1200, execution_credit_rounds: 0, execution_credit_micro_cny: 0, failure_count: 0, updated_at: new Date().toISOString() }, active_reservations: 0, active_runs: 0, readiness: { ready: true, failed: [] } }
  }

  async users(): Promise<AdminUserPage> { return { date: '20260907', users: structuredClone(this.data) } }

  async createUser(input: CreateUserInput): Promise<UserCommandResponse> {
    const user: AdminUserSummary = { id: adminUserId(`user-${Date.now()}`), account: input.account.trim(), role: 'demo_user', status: 'active', expires_at: input.expires_at, quota_override: input.quota_override, must_change_password: true, revision: 0 }
    const item = { user, usage: { answer_rounds: 0, tokens: { input_cache_hit: 0, input_cache_miss: 0, output: 0, reasoning: 0 }, actual_micro_cny: 0 } }
    this.data.push(item)
    return { user: structuredClone(user), temporary_password: 'temporary-mock-password' }
  }

  async updateUser(id: AdminUserId, revision: number, patch: UserPatchInput): Promise<UserCommandResponse> {
    const item = this.data.find(entry => entry.user.id === id)
    if (!item || item.user.revision !== revision) throw new Error('SETTINGS_VERSION_CONFLICT')
    item.user = { ...item.user, ...patch, revision: revision + 1 }
    return { user: structuredClone(item.user) }
  }

  async resetPassword(id: AdminUserId, revision: number): Promise<UserCommandResponse> {
    const item = this.data.find(entry => entry.user.id === id)
    if (!item || item.user.revision !== revision) throw new Error('SETTINGS_VERSION_CONFLICT')
    item.user = { ...item.user, must_change_password: true, revision: revision + 1 }
    return { user: structuredClone(item.user), temporary_password: 'temporary-mock-password' }
  }

  async deleteUser(id: AdminUserId): Promise<DeletionJob> {
    const index = this.data.findIndex(entry => entry.user.id === id)
    if (index >= 0) this.data.splice(index, 1)
    return { job_id: 'job-mock', user_id: id, requested_by: 'admin-1', request_id: 'req-mock', state: 'queued', stage: 'disable_user', revision: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  }

  async resetQuota(_id: AdminUserId): Promise<void> {}

  async settings(): Promise<AiSettings> { return structuredClone(this.currentSettings) }

  async updateSettings(revision: number, settings: AiSettings): Promise<AiSettings> {
    if (revision !== this.currentSettings.revision) throw new Error('SETTINGS_VERSION_CONFLICT')
    this.currentSettings = { ...structuredClone(settings), revision: revision + 1 }
    return structuredClone(this.currentSettings)
  }

  async enable(revision: number): Promise<void> {
    if (revision !== this.currentSettings.revision) throw new Error('SETTINGS_VERSION_CONFLICT')
    this.currentSettings.service.enabled = true
  }

  async disable(revision: number, message: string): Promise<void> {
    if (revision !== this.currentSettings.revision) throw new Error('SETTINGS_VERSION_CONFLICT')
    this.currentSettings.service.enabled = false
    this.currentSettings.service.maintenance_message = message || this.currentSettings.service.maintenance_message
  }

  async failures(): Promise<MetadataPage<FailureLog>> { return { items: [{ request_id: 'req-mock', run_id: 'run-mock', identity_type: 'user', stage: 'provider', model: 'deepseek-v4-flash', http_status: 504, error_code: 'PROVIDER_TIMEOUT', retryable: true, first_token_latency_ms: 0, duration_ms: 100, input_chars: 12, had_image: false, usage_missing: true, created_at: new Date().toISOString() }] } }

  async auditLogs(): Promise<MetadataPage<AuditLog>> { return { items: [{ admin_user_id: 'admin-1', action: 'ai.settings.updated', target_type: 'settings', target_id: 'global', request_id: 'req-mock', created_at: new Date().toISOString() }] } }
}

export const mockAdminApi = new MockAdminApi()
const useMockAdminApi = import.meta.env.MODE === 'test' || (import.meta.env.DEV && import.meta.env.VITE_AI_MOCK === 'true')
export const adminApi: AdminApi = useMockAdminApi ? mockAdminApi : new HttpAdminApi()
