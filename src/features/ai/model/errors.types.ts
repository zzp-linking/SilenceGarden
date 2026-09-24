/** AI 接口统一错误信息。 */
export interface ApiError {
  /** 稳定错误码，用于前端分支判断。 */
  code: string
  /** 可展示给用户的错误说明。 */
  message: string
  /** 是否允许用户或传输层重试。 */
  retryable: boolean
  /** 服务端请求追踪 ID，用于关联日志。 */
  requestId?: string
  /** 服务端附带的结构化诊断信息。 */
  details?: Record<string, unknown>
}

/** AI 接口成功响应信封。 */
export interface ApiEnvelope<T> {
  /** 接口返回的业务数据。 */
  data: T
  /** 本次请求的服务端追踪 ID。 */
  request_id: string
}

/** AI 接口失败响应信封。 */
export interface ApiErrorEnvelope {
  /** 结构化错误信息。 */
  error: ApiError
}
