import { computed, onScopeDispose, shallowRef } from 'vue'
import { V2HttpError } from '@/api/clientV2'
import type { KnowledgePage } from '@/api/agentAdmin'

/** 写失败不自动重试；保留服务端核对标识，冲突提示管理员重新打开编辑。 */
/** @param reason 业务或网络失败原因，转换为安全的可读提示。 */
export function knowledgeError(reason: unknown): string {
  if (reason instanceof V2HttpError) {
    const details = reason.apiError.details
    const identity = typeof details?.document_id === 'string' ? `（文档 ${details.document_id}）` : ''
    return `${reason.message}${identity}`
  }
  return reason instanceof Error ? `${reason.message}；请刷新核对结果后再操作。` : '操作失败，请刷新核对结果。'
}

/** 每个列表拥有自己的游标历史；新的筛选/路由请求使旧响应失效。 */
/** @param loader 按游标读取一页的函数，应接收取消信号并返回服务端分页事实。 */
export function useKnowledgePage<T>(loader: (cursor?: string, signal?: AbortSignal) => Promise<KnowledgePage<T>>) {
  /** data：当前服务器分页快照，不在浏览器中推测执行事实。 */
  const data = shallowRef<KnowledgePage<T>>({ items: [] })
  /** loading：当前读取请求的加载状态，仅允许最新请求更新。 */
  const loading = shallowRef(false)
  /** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
  const error = shallowRef('')
  /** index：当前页在本地游标历史中的零起始下标，不表示数据库 offset。 */
  const index = shallowRef(0)
  /** cursors：已访问页面的游标历史，翻回旧页时仍从服务器重新读取。 */
  let cursors: Array<string | undefined> = [undefined]
  /** epoch：递增的本地请求代号，筛选、路由或生命周期改变后使旧响应失效。 */
  let epoch = 0
  /** controller：当前读取的取消控制器，新请求或卸载时中止旧读取。 */
  let controller: AbortController | undefined
  onScopeDispose(() => { epoch++; controller?.abort() })
  /**
   * go 载入指定页，取消旧请求并用递增代号阻止旧响应覆盖新页面。
   * @param target 目标页在本地游标历史中的零起始下标。
   * @param cursor 目标页对应的服务端不透明游标。
   */
  async function go(target: number, cursor?: string) {
    const ticket = ++epoch
    controller?.abort()
    controller = new AbortController()
    loading.value = true; error.value = ''
    try {
      const value = await loader(cursor, controller.signal)
      if (ticket !== epoch) return
      data.value = value; index.value = target
      cursors = [...cursors.slice(0, target), cursor]
    } catch (reason) { if (ticket === epoch) error.value = knowledgeError(reason) }
    finally { if (ticket === epoch) loading.value = false }
  }
  /** first 清空游标历史后重读首页，适用于筛选变化或新增、删除完成后。 */
  function first() { cursors = [undefined]; data.value = { items: [] }; index.value = 0; return go(0) }
  return { data, loading, error, index, canPrevious: computed(() => index.value > 0), first,
    reload: () => go(index.value, cursors[index.value]),
    next: () => data.value.next_cursor && go(index.value + 1, data.value.next_cursor),
    previous: () => index.value > 0 && go(index.value - 1, cursors[index.value - 1]) }
}
