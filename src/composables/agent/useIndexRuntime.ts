import { onScopeDispose, shallowRef } from 'vue'
import { agentIndexAdminApi, type IndexRuntimeState } from '@/api/agentIndexAdmin'
import { knowledgeError } from './useKnowledgePage'
import { useIndexPolling } from './useIndexPolling'

/** 每个页面持有一份运行状态快照。刷新失败时保留历史计数并禁止新操作，不能将旧 accepting 开关视作仍然就绪。 */
export function useIndexRuntime() {
  /** state：当前服务器运行事实，刷新失败时保留计数并关闭新操作资格。 */
  const state = shallowRef<IndexRuntimeState | null>(null)
  /** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
  const error = shallowRef('')
  /** loading：当前读取请求的加载状态，仅允许最新请求更新。 */
  const loading = shallowRef(false)
  /** epoch：递增的本地请求代号，筛选、路由或生命周期改变后使旧响应失效。 */
  let epoch = 0
  /** controller：当前读取的取消控制器，新请求或卸载时中止旧读取。 */
  let controller: AbortController | undefined
  /**
   * reload 取消过期运行状态请求，并将本轮取消信号接入当前控制器。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  async function reload(signal?: AbortSignal) {
    const ticket = ++epoch
    controller?.abort(); const current = new AbortController(); controller = current
    const abort = () => current.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) current.abort()
    loading.value = true; error.value = ''
    try { const value = await agentIndexAdminApi.runtime(current.signal); if (ticket === epoch) state.value = value }
    catch (reason) { if (ticket === epoch) { error.value = knowledgeError(reason); if (state.value) state.value = { ...state.value, ready: false, accepting: false, retrieval_ready: false, reason: 'status_unavailable' } } }
    finally { signal?.removeEventListener('abort', abort); if (ticket === epoch) loading.value = false }
  }
  useIndexPolling(() => !!state.value && state.value.queued + state.value.running > 0, reload)
  onScopeDispose(() => { epoch++; controller?.abort() })
  void reload()
  return { state, error, loading, reload }
}
