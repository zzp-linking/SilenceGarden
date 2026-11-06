import { onScopeDispose, shallowRef } from 'vue'
import type { IndexJob } from '@/api/agentIndexAdmin'
import { knowledgeError } from './useKnowledgePage'

/** 写入结果不确定时，同时保留原幂等键与冻结的请求闭包。重试不得用旧键重新展开已变化的界面选择。 */
export function useIndexCommand() {
  /** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
  const busy = shallowRef(false)
  /** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
  const error = shallowRef('')
  /** requestKey：本次命令的幂等键，核对前不能改用新键提交同一操作。 */
  const requestKey = shallowRef('')
  /** job：最近一次已确认接纳的服务端任务头部。 */
  const job = shallowRef<IndexJob | null>(null)
  /** submit：冻结本次目标和意图的请求闭包，重试时必须复用。 */
  let submit: ((key: string) => Promise<IndexJob>) | undefined
  /** disposed：消费作用域是否已经销毁，阻止异步结果回写已卸载界面。 */
  let disposed = false
  onScopeDispose(() => { disposed = true })
  /** attempt 显式发送已冻结的命令，成功后清除待核对键；失败时保留原请求供人工重试。 */
  async function attempt() {
    if (busy.value || !submit || disposed) return
    busy.value = true; error.value = ''
    try {
      const result = await submit(requestKey.value)
      if (disposed) return
      job.value = result; submit = undefined; requestKey.value = ''
      return result
    } catch (reason) { if (!disposed) error.value = knowledgeError(reason) }
    finally { if (!disposed) busy.value = false }
  }
  /**
   * run 为新命令生成一次幂等键并冻结操作闭包；存在待核对命令时拒绝开始另一命令。
   * @param operation 已经固定目标与意图的提交闭包，接收本次唯一幂等键。
   */
  function run(operation: (key: string) => Promise<IndexJob>) {
    if (busy.value || submit || disposed) return Promise.resolve(undefined)
    submit = operation; requestKey.value = crypto.randomUUID(); job.value = null
    return attempt()
  }
  /** reviewed 管理员核对服务端结果后，清除本地待核对请求并允许后续操作。 */
  function reviewed() { if (!busy.value) { submit = undefined; requestKey.value = ''; error.value = '' } }
  return { busy, error, requestKey, job, run, retry: attempt, reviewed }
}
