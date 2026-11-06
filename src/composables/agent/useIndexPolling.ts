import { onScopeDispose, watch } from 'vue'

/** 每个消费方独占一个定时器和一次轮询请求；后台页降低频率，终态停止。卸载中止读取，但不取消服务端已经接纳的任务。 */
/**
 * @param active 读取当前是否仍有在途任务的响应式函数。
 * @param reload 只读刷新函数，接收当前轮询的取消信号。
 */
export function useIndexPolling(active: () => boolean, reload: (signal: AbortSignal) => Promise<unknown>) {
  /** timer：本消费方唯一的下一轮轮询定时器。 */
  let timer: ReturnType<typeof setTimeout> | undefined
  /** controller：当前读取的取消控制器，新请求或卸载时中止旧读取。 */
  let controller: AbortController | undefined
  /** disposed：消费作用域是否已经销毁，阻止异步结果回写已卸载界面。 */
  let disposed = false
  /** running：是否已有轮询读取在执行，防止重叠请求。 */
  let running = false
  /** clear 清除当前定时器并重置句柄，避免重复调度。 */
  function clear() { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  /**
   * schedule 取消旧定时器后按可见性安排下一次轮询，避免请求重叠。
   * @param immediate 是否立即调度一次读取；false 按页面可见性设置间隔。
   */
  function schedule(immediate = false) {
    clear()
    if (disposed || !active() || running) return
    timer = setTimeout(tick, immediate ? 0 : document.hidden ? 15_000 : 2_000)
  }
  /** tick 执行一次只读刷新，完成后再调度下一轮，不自动重放写操作。 */
  async function tick() {
    timer = undefined
    if (disposed || !active() || running) return
    running = true
    controller = new AbortController()
    try { await reload(controller.signal) }
    catch { /* 错误由所属资源展示；轮询只刷新读取，不重放写操作。 */ }
    finally { running = false; schedule() }
  }
  /** visibility：页面可见性回调，回到前台后及时刷新仍在途任务。 */
  const visibility = () => schedule(!document.hidden)
  document.addEventListener('visibilitychange', visibility)
  watch(active, value => { if (value) schedule(); else { clear(); controller?.abort() } }, { immediate: true })
  onScopeDispose(() => { disposed = true; clear(); controller?.abort(); document.removeEventListener('visibilitychange', visibility) })
}
