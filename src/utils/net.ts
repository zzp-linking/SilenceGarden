import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useUserStore } from '@/stores/user'
import { message } from '@/utils/talk'
import type { ApiResponse } from '@/types/api'

/** Preserve a named business error and its partial-save receipt. */
export class ApiError extends Error {
  constructor(public readonly code: number | boolean | string, message: string, public readonly result: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap<T>(response: ApiResponse<unknown>): T {
  const result = response.result
  // 旧列表接口会额外包一层 { list }，这里统一还原成调用方期望的数组。
  if (isRecord(result) && Object.keys(result).length === 1 && Array.isArray(result.list)) {
    return result.list as T
  }
  if (isRecord(result)) {
    return { msg: response.message, ...result } as T
  }
  return result as T
}

const service: AxiosInstance = axios.create({
  timeout: 10000,
  withCredentials: true
})

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const result = response.data
    if (result.code === 200) return response

    // 101 是旧接口约定的会话失效码，需要同时清理本地身份并回到登录页。
    if (result.code === 101) {
      message(result.message, 4)
      useUserStore().expireSession()
    } else if (result.message) {
      message(result.message, 4)
    }
    return Promise.reject(new ApiError(result.code, result.message || '请求失败', result.result))
  },
  (error: AxiosError<Partial<ApiResponse<unknown>>>) => {
    // 切换文章时主动取消旧详情请求，不向用户显示无意义的“已取消”错误。
    if (axios.isCancel(error)) return Promise.reject(error)
    const errorMessage = error.response?.data?.message || error.message
    message(errorMessage, 4)
    if (error.response?.data?.code !== undefined) return Promise.reject(new ApiError(error.response.data.code, errorMessage, error.response.data.result))
    return Promise.reject(error)
  }
)

export interface NetClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T>
  request<T, D = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data: D): Promise<T>
}

const net: NetClient = {
  async request<T, D = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data: D) {
    const response = await service.request<ApiResponse<unknown>>({ method, url, data })
    return unwrap<T>(response.data)
  },
  async get<T>(url: string, config?: AxiosRequestConfig) {
    const response = await service.get<ApiResponse<unknown>>(url, config)
    return unwrap<T>(response.data)
  },

  async post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
    const response = await service.post<ApiResponse<unknown>>(url, data, config)
    return unwrap<T>(response.data)
  }
}

export default net

/** 将旧接口 URL 中的 `{参数名}` 占位符替换为实际路径参数。 */
export function restful<T extends object>(url: string, params: T): string {
  return Object.keys(params).reduce(
    (result, key) => result.replace(new RegExp(`{${key}}`, 'g'), String(params[key as keyof T])),
    url
  )
}
