import type { UserRole } from '@/types/auth'

export type AdminUserId = string & { readonly __brand: 'AdminUserId' }

export interface QuotaOverride {
  daily_round_limit?: number
  daily_cost_limit_micro_cny?: number
  max_concurrent_runs?: number
}

export interface AdminUserSummary {
  id: AdminUserId
  account: string
  role: UserRole
  status: 'active' | 'disabled'
  expires_at?: string
  must_change_password: boolean
  quota_override?: QuotaOverride
  revision: number
}

export interface UserDailyUsage {
  answer_rounds: number
  tokens: {
    input_cache_hit: number
    input_cache_miss: number
    output: number
    reasoning: number
  }
  actual_micro_cny: number
}

export interface AdminUserListItem {
  user: AdminUserSummary
  usage: UserDailyUsage
}

export interface AdminUserPage {
  date: string
  users: AdminUserListItem[]
  next_cursor?: string
}

export interface AdminUsage {
  date: string
  global: {
    answer_rounds: number
    calls: {
      answer: number
      moderation: number
      title: number
      summary: number
    }
    tokens: UserDailyUsage['tokens']
    actual_micro_cny: number
    execution_credit_rounds: number
    execution_credit_micro_cny: number
    failure_count: number
    last_failure_code?: string
    updated_at: string
  }
  active_reservations: number
  active_runs: number
  readiness: {
    ready: boolean
    failed?: string[]
  }
}

export interface ScopeQuota {
  daily_micro_cny: number
  daily_rounds: number
  max_concurrent: number
  requests_per_minute: number
}

export interface AiSettings {
  id: 'global'
  revision: number
  updated_by: string
  updated_at: string
  service: {
    enabled: boolean
    maintenance_message: string
  }
  quotas: {
    global: ScopeQuota
    account_default: ScopeQuota
    anonymous_ip: ScopeQuota
    anonymous_device: ScopeQuota
  }
  limits: {
    login_text_chars: number
    anonymous_text_chars: number
    context_target_tokens: number
    summary_trigger_tokens: number
    recent_messages: number
    max_output_tokens: number
    run_timeout_seconds: number
    image_max_bytes: number
    image_max_pixels: number
    image_concurrent: number
    allowed_image_mimes: string[]
  }
  images: {
    enabled: boolean
  }
  models: {
    answer: string
    vision: string
    moderation: string
    title: string
    summary: string
    allowlist: string[]
  }
  pricing: {
    version: number
    effective_at: string
    exchange_rate_micros: number
    safety_margin_micros: number
    models: Record<string, {
      input_cache_hit_peak_micro_cny_per_million: number
      input_cache_miss_peak_micro_cny_per_million: number
      output_peak_micro_cny_per_million: number
    }>
  }
  moderation: {
    rule_version: string
  }
  retention: {
    failure_log_days: number
    audit_log_days: number
  }
  starters: [string, string, string, string]
}

export interface FailureLog {
  request_id: string
  run_id: string
  identity_type: 'user' | 'anonymous'
  identity_id?: string
  stage: string
  model: string
  http_status: number
  error_code: string
  retryable: boolean
  first_token_latency_ms: number
  duration_ms: number
  input_chars: number
  had_image: boolean
  usage_missing: boolean
  provider_request_id?: string
  created_at: string
}

export interface AuditLog {
  admin_user_id: string
  action: string
  target_type: string
  target_id?: string
  request_id: string
  changes?: Array<{
    field: string
    before: { kind: string; text?: string; number?: number; bool?: boolean; time?: string }
    after: { kind: string; text?: string; number?: number; bool?: boolean; time?: string }
  }>
  created_at: string
}

export interface MetadataPage<T> {
  items: T[]
  next_cursor?: string
}

export interface UserCommandResponse {
  user: AdminUserSummary
  temporary_password?: string
}

export interface DeletionJob {
  job_id: string
  user_id: string
  requested_by: string
  request_id: string
  state: 'queued' | 'running' | 'failed' | 'completed'
  stage: string
  error_code?: string
  revision: number
  created_at: string
  updated_at: string
  completed_at?: string
}
