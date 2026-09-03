export interface ApiResponse<T> {
  code: number | boolean
  message: string
  result: T
}

export interface ApiListResult<T> {
  list: T[]
}

export interface ApiErrorResult {
  code: 101 | false | number
  message: string
  result: Record<string, never>
}

export interface IdParams {
  id: string
}

export interface TitleParams {
  title: string
}

export interface KeywordParams {
  keyword: string
}
