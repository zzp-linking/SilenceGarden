import type { AiApi } from '@/api/chat'
import type { ClientRunState, RunEvent, RunId, RunRecord } from '@/types/ai'

export interface RunTransportCallbacks { onEvent: (event: RunEvent) => void; onConnection?: (state: ClientRunState['connection'], attempt: number) => void; onError?: (error: Error) => void }
interface Handle { controller: AbortController; timer?: ReturnType<typeof setTimeout>; wakeDelay?: () => void; kind: 'login' | 'anonymous' }

const terminalTypes = new Set(['run.completed', 'run.stopped', 'run.failed'])
const backoff = [500, 1000, 2000, 5000, 10000]

export class RunTransportManager {
  private readonly handles = new Map<RunId, Handle>()
  constructor(private readonly api: AiApi) {}

  startLogin(run: RunRecord, callbacks: RunTransportCallbacks, after = 0): void { this.start(run.run_id, { ...callbacks, kind: 'login' }, after, run) }
  startAnonymous(run: RunRecord, callbacks: RunTransportCallbacks, input: Parameters<AiApi['anonymousStream']>[0], image?: Blob): void { this.start(run.run_id, { ...callbacks, kind: 'anonymous' }, 0, run, input, image) }
  stop(runId: RunId): void { const handle = this.handles.get(runId); if (!handle) return; handle.controller.abort(); if (handle.timer) clearTimeout(handle.timer); handle.wakeDelay?.(); this.handles.delete(runId) }
  closeAnonymous(): void { for (const [runId, handle] of this.handles) if (handle.kind === 'anonymous') this.stop(runId) }
  closeAll(): void { for (const runId of this.handles.keys()) this.stop(runId) }
  has(runId: RunId): boolean { return this.handles.has(runId) }

  private start(runId: RunId, callbacks: RunTransportCallbacks & { kind: Handle['kind'] }, after: number, run: RunRecord, input?: Parameters<AiApi['anonymousStream']>[0], image?: Blob): void {
    this.stop(runId)
    const handle: Handle = { controller: new AbortController(), kind: callbacks.kind }; this.handles.set(runId, handle)
    const consume = async (): Promise<void> => {
      let attempt = 0
      while (!handle.controller.signal.aborted) {
        callbacks.onConnection?.(attempt ? 'backoff' : 'connecting', attempt)
        try {
          const stream = callbacks.kind === 'login' ? this.api.subscribeRun(runId, after, handle.controller.signal) : this.api.anonymousStream(input!, image, handle.controller.signal)
          callbacks.onConnection?.('open', attempt)
          for await (const event of stream) { callbacks.onEvent(event); after = Math.max(after, event.seq); if (terminalTypes.has(event.type)) { callbacks.onConnection?.('closed', attempt); this.stop(runId); return } }
          if (handle.controller.signal.aborted) return
          /* 匿名流是一次性请求：无终态事件就结束了属于异常中断，必须上报，否则界面会一直停在「正在回应」。 */
          if (callbacks.kind === 'anonymous') { callbacks.onError?.(new Error('连接中断，这次回答没有完成')); this.stop(runId); return }
          throw new Error('SSE connection closed')
        } catch (error) {
          if (handle.controller.signal.aborted) return
          if (callbacks.kind === 'anonymous') { callbacks.onError?.(error instanceof Error ? error : new Error('匿名流连接失败')); this.stop(runId); return }
          attempt += 1; callbacks.onConnection?.('backoff', attempt); const delay = backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 10000
          await new Promise<void>(resolve => { const finish = (): void => { handle.timer = undefined; handle.wakeDelay = undefined; resolve() }; handle.wakeDelay = finish; handle.timer = setTimeout(finish, delay) })
        }
      }
    }
    void consume().catch(error => callbacks.onError?.(error instanceof Error ? error : new Error('run transport failed')))
  }
}
