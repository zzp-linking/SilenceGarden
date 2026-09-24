/** 旧版通用 API 的成功响应信封。 */
export interface ApiResponse<T> {
  /** 业务状态码；旧接口可能使用数字或布尔值。 */
  code: number | boolean
  /** 服务端返回的提示信息。 */
  message: string
  /** 接口返回的业务结果。 */
  result: T
}

/** 旧版列表接口的结果容器。 */
export interface ApiListResult<T> {
  /** 接口返回的数据列表。 */
  list: T[]
}

/** 旧版 API 的失败响应。 */
export interface ApiErrorResult {
  /** 失败状态码；101 和 false 是旧接口保留值。 */
  code: 101 | false | number
  /** 可展示或记录的错误信息。 */
  message: string
  /** 失败时固定为空对象的结果字段。 */
  result: Record<string, never>
}

/** 按资源 ID 请求详情或执行操作时使用的路径参数。 */
export interface IdParams {
  /** 目标资源的数据库 ID。 */
  id: string
}

/** 按标题查询内容时使用的路径参数。 */
export interface TitleParams {
  /** 目标内容的完整标题。 */
  title: string
}

/** 模糊检索接口使用的查询参数。 */
export interface KeywordParams {
  /** 用户输入的搜索关键词。 */
  keyword: string
}
