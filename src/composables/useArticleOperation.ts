import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import net, { ApiError } from '@/utils/net'
import { articleAdminBase, collectionsApi } from '@/api/articleCollections'
import type { ArticleWriteResult } from '@/types/article'
import { useUserStore } from '@/stores/user'

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE'
interface PendingWrite { requestId: string; method: Method; url: string; payload: Record<string, unknown> }
const terminalCodes = new Set(['INVALID_ARGUMENT', 'ARTICLE_NOT_FOUND', 'COLLECTION_NOT_FOUND', 'VERSION_CONFLICT', 'MEMBERSHIP_CONFLICT', 'COLLECTION_NOT_EMPTY', 'REQUEST_ID_CONFLICT'])

/** 固定一条命令，在刷新或响应结果不确定时保持其身份不变。 */
export function useArticleOperation(scope: string) {
  const user = useUserStore()
  const storageKey = 'sg.article.write.' + (user.user?.id || 'guest') + '.' + scope
  const job = ref<PendingWrite | null>(null)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const errorCode = shallowRef('')
  const result = ref<ArticleWriteResult | null>(null)
  let epoch = 0
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as PendingWrite | null
    if (saved && saved.url.startsWith(articleAdminBase + '/') && /^[a-zA-Z0-9_-]{8,128}$/.test(saved.requestId)
      && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(saved.method) && saved.payload && typeof saved.payload === 'object') {
      job.value = saved
      error.value = '上次保存结果待确认，请继续确认或同步。'
    }
  } catch { sessionStorage.removeItem(storageKey) }
  onBeforeUnmount(() => { epoch++ })
  function clear() { job.value = null; sessionStorage.removeItem(storageKey) }
  function settle(value: ArticleWriteResult, ticket: number): ArticleWriteResult {
    if (ticket === epoch) result.value = value
    if (value.state && value.state !== 'complete') throw new ApiError('SYNC_PENDING', '保存结果需要继续确认，请继续同步。', value)
    if (ticket === epoch) { clear(); error.value = '' }
    return value
  }
  async function attempt(ticket: number, action: () => Promise<ArticleWriteResult>) {
    busy.value = true; error.value = ''; errorCode.value = ''
    try { return settle(await action(), ticket) }
    catch (cause) {
      if (ticket === epoch) {
        errorCode.value = cause instanceof ApiError ? String(cause.code) : ''
        if (cause instanceof ApiError && cause.result && typeof cause.result === 'object') result.value = cause.result as ArticleWriteResult
        if (cause instanceof ApiError && (result.value?.state === 'failed' || terminalCodes.has(String(cause.code)) || cause.code === 101 || cause.code === 403)) clear()
        error.value = cause instanceof Error ? cause.message : '保存结果待确认，请继续同步。'
      }
      throw cause
    } finally { if (ticket === epoch) busy.value = false }
  }
  async function execute(method: Method, url: string, payload: Record<string, unknown>, perform?: (snapshot: Record<string, unknown>) => Promise<ArticleWriteResult | void>) {
    if (job.value) throw new Error('请先确认上一次保存结果')
    const requestId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')
    const snapshot = JSON.parse(JSON.stringify({ ...payload, requestId })) as Record<string, unknown>
    const pending: PendingWrite = { requestId, method, url, payload: snapshot }
    sessionStorage.setItem(storageKey, JSON.stringify(pending))
    job.value = pending
    return attempt(epoch, async () => perform ? (await perform(snapshot) || { state: 'complete' }) : net.request<ArticleWriteResult>(method, url, snapshot))
  }
  async function recover() {
    const pending = job.value
    if (!pending) throw new Error('没有待确认的保存操作')
    return attempt(epoch, async () => {
      try {
        const status = await collectionsApi.operation(pending.requestId)
        if (status.state === 'complete') return status
        return await collectionsApi.operation(pending.requestId, true)
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === 'OPERATION_NOT_FOUND')
          return net.request<ArticleWriteResult>(pending.method, pending.url, pending.payload)
        throw cause
      }
    })
  }
  function clearError() { error.value = ''; errorCode.value = '' }
  return { busy, error, errorCode, clearError, result, pending: computed(() => job.value !== null), snapshot: computed(() => job.value?.payload), execute, recover }
}
