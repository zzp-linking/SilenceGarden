import type { ApiEnvelope, ApiError, ApiErrorEnvelope } from '@/types/ai'

export class V2HttpError extends Error {
  readonly status: number
  readonly apiError: ApiError

  constructor(status: number, apiError: ApiError) {
    super(apiError.message)
    this.name = 'V2HttpError'
    this.status = status
    this.apiError = apiError
  }
}

export interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export interface ClientV2Options {
  baseUrl?: string
  fetcher?: FetchLike
  refreshPath?: string
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function parseError(value: unknown, status: number, requestId?: string): ApiError {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string') {
    return {
      code: value.error.code,
      message: value.error.message,
      retryable: value.error.retryable === true,
      requestId: typeof value.error.request_id === 'string' ? value.error.request_id : requestId,
      details: isRecord(value.error.details) ? value.error.details : undefined
    }
  }
  return { code: status === 401 ? 'AUTH_REQUIRED' : 'HTTP_ERROR', message: `请求失败（${status}）`, retryable: status >= 500, requestId }
}

export class ClientV2 {
  private readonly baseUrl: string
  private readonly fetcher: FetchLike
  private readonly refreshPath: string
  private refreshPromise: Promise<boolean> | null = null

  constructor(options: ClientV2Options = {}) {
    this.baseUrl = options.baseUrl ?? '/home/api'
    this.fetcher = options.fetcher ?? fetch.bind(globalThis)
    this.refreshPath = options.refreshPath ?? '/session/refresh'
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.fetcher(`${this.baseUrl}${this.refreshPath}`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } })
        .then(response => response.ok)
        .catch(() => false)
        .finally(() => { this.refreshPromise = null })
    }
    return this.refreshPromise
  }

  async request<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    headers.set('Accept', 'application/json')
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers, credentials: 'include' })
    if (response.status === 401 && canRetry && path !== this.refreshPath && await this.refresh()) return this.request<T>(path, init, false)

    const requestId = response.headers.get('X-Request-ID') ?? undefined
    const raw: unknown = response.status === 204 ? {} : await response.json().catch(() => ({}))
    if (!response.ok) throw new V2HttpError(response.status, parseError(raw, response.status, requestId))
    if (!isRecord(raw) || !isRecord(raw.data)) return raw as T
    return (raw as unknown as ApiEnvelope<T>).data
  }

  async requestRaw(path: string, init: RequestInit = {}, canRetry = true): Promise<Response> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, credentials: 'include' })
    if (response.status === 401 && canRetry && path !== this.refreshPath && await this.refresh()) return this.requestRaw(path, init, false)
    if (!response.ok) {
      const requestId = response.headers.get('X-Request-ID') ?? undefined
      const raw: unknown = await response.clone().json().catch(() => ({} as ApiErrorEnvelope))
      throw new V2HttpError(response.status, parseError(raw, response.status, requestId))
    }
    return response
  }
}

export const clientV2 = new ClientV2()
