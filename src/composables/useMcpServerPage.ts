import { onScopeDispose, shallowRef } from 'vue'
import { mcpServerError, type McpCursorPage } from '@/api/agentMcpServerAdmin'

/** 管理列表使用的可序列化查询参数。 */
type Filters = Record<string, string | undefined>

/** 管理列表共享游标、已应用筛选和请求取消逻辑。 */
export function useMcpServerPage<T>(read: (filters: Filters, signal: AbortSignal) => Promise<McpCursorPage<T>>) {
  const items = shallowRef<T[]>([]) // 当前页条目。
  const nextCursor = shallowRef('') // 服务端提供的下一页位置。
  const previous = shallowRef<string[]>([]) // 已浏览页面的游标栈。
  const cursor = shallowRef('') // 当前页的起始游标。
  const loading = shallowRef(false) // 当前列表读取状态。
  const error = shallowRef('') // 当前读取错误。
  let applied: Filters = {} // 翻页始终使用最近提交的筛选条件。
  let pending: AbortController | undefined // 过期查询应取消且不得覆盖结果。

  /** 请求指定页，只有最新且成功的响应可以更新表格与游标。 */
  async function load(position: string, history: string[], filters: Filters) {
    pending?.abort()
    const request = new AbortController()
    pending = request
    loading.value = true
    error.value = ''
    try {
      const page = await read({ ...filters, cursor: position }, request.signal)
      if (request.signal.aborted) return
      items.value = page.items
      nextCursor.value = page.next_cursor ?? ''
      cursor.value = position
      previous.value = history
      applied = filters
    } catch (reason) {
      if (!request.signal.aborted) error.value = mcpServerError(reason)
    } finally {
      if (pending === request) {
        loading.value = false
        pending = undefined
      }
    }
  }

  /** 应用新筛选并返回第一页。 */
  const search = (filters: Filters = {}) => load('', [], { ...filters })
  /** 重新读取当前页。 */
  const refresh = () => load(cursor.value, previous.value, applied)
  /** 继续读取下一页并保存返回路径。 */
  const next = () => nextCursor.value && load(nextCursor.value, [...previous.value, cursor.value], applied)
  /** 返回上一页。 */
  const back = () => previous.value.length && load(previous.value.at(-1) ?? '', previous.value.slice(0, -1), applied)

  onScopeDispose(() => pending?.abort())
  return { items, nextCursor, previous, loading, error, search, refresh, next, back }
}

/** 将空值显示为破折号，时间按管理者浏览器的本地时区展示。 */
export function mcpLocalTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

/** 将 API 的 RFC 3339 时间转换为本地日期时间输入值。 */
export function mcpDateInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

