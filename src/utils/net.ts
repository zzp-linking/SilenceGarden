import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import router from '@/router'
import { useUserStore } from '@/store/user'
import { message } from '@/utils/talk'
import type { ApiResponse } from '@/types/api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap<T>(response: ApiResponse<unknown>): T {
  const result = response.result
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

    if (result.code === 101) {
      message(result.message, 4)
      useUserStore().logout()
      void router.push('/login')
    } else if (result.message) {
      message(result.message, 4)
    }
    return Promise.reject(new Error(result.message || '请求失败'))
  },
  (error: AxiosError<{ message?: string }>) => {
    const errorMessage = error.response?.data?.message || error.message
    message(errorMessage, 4)
    return Promise.reject(error)
  }
)

export interface NetClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T>
}

const net: NetClient = {
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

export function restful<T extends object>(url: string, params: T): string {
  return Object.keys(params).reduce(
    (result, key) => result.replace(new RegExp(`{${key}}`, 'g'), String(params[key as keyof T])),
    url
  )
}
