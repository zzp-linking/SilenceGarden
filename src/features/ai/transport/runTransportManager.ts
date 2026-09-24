/**
 * 每个 Run 至多一条 SSE 消费循环。
 *
 * 登录流：断线可按 after 续订；序号缺口或 HISTORY_LOST 则从 0 回放。
 * 匿名流：与 HTTP 请求同生命周期，断线即失败，不重连。
 */
import type { AiApi } from '@/api/chat'
import { V2HttpError } from '@/api/clientV2'
import { isTerminalRunState } from '@/features/ai/model'
import type { ClientRunState, RunEvent, RunId, RunRecord } from '@/features/ai/model'

/** 页面把 SSE 帧交给 store 的回调。onReset 用于从 0 回放前清空拼接缓冲。 */
export interface RunTransportCallbacks {
  onEvent: (event: RunEvent) => void
  onReset?: () => void
  onConnection?: (state: ClientRunState['connection'], attempt: number) => void
  onError?: (error: Error) => void
}
/** 一条在飞流的取消句柄。wakeDelay 用于 stop() 时立刻结束退避等待。 */
interface Handle {
  controller: AbortController
  timer?: ReturnType<typeof setTimeout>
  wakeDelay?: () => void
  kind: 'login' | 'anonymous'
  runId: RunId
}

const terminalTypes = new Set(['run.completed', 'run.stopped', 'run.failed'])
/** 登录流断线后的退避间隔（毫秒），超过次数则交给用户手动重连。 */
const backoff = [500, 1000, 2000, 5000, 10000]

export class RunTransportManager {
  private readonly handles = new Map<RunId, Handle>()
  constructor(private readonly api: AiApi) {}

  /**
   * 订阅登录用户的可重放事件流。
   * @param after 已确认序号；刷新恢复时通常传 0 以便重放全文
   */
  startLogin(run: RunRecord, callbacks: RunTransportCallbacks, after = 0): void { this.start(run.run_id, { ...callbacks, kind: 'login' }, after, run) }
  /** 打开匿名一次性流。input 在重试路径上不会被再用（匿名不重试）。 */
  startAnonymous(run: RunRecord, callbacks: RunTransportCallbacks, input: Parameters<AiApi['anonymousStream']>[0], image?: Blob): void { this.start(run.run_id, { ...callbacks, kind: 'anonymous' }, 0, run, input, image) }
  /**
   * 匿名首帧 run.created 把占位 run_id 换成服务端 ID 时，把 AbortController 跟着挪过去。
   */
  rebind(from: RunId, to: RunId): void {
    if (from === to) return
    const handle = this.handles.get(from)
    if (!handle) return
    this.handles.delete(from)
    handle.runId = to
    this.handles.set(to, handle)
  }
  /** 中止该 Run 的读取循环并清掉退避定时器。 */
  stop(runId: RunId): void { const handle = this.handles.get(runId); if (!handle) return; handle.controller.abort(); if (handle.timer) clearTimeout(handle.timer); handle.wakeDelay?.(); this.handles.delete(runId) }
  /** 登出前只关匿名流，登录用户的 Run 由 closeAll 处理。 */
  closeAnonymous(): void { for (const [runId, handle] of this.handles) if (handle.kind === 'anonymous') this.stop(runId) }
  closeAll(): void { for (const runId of this.handles.keys()) this.stop(runId) }
  has(runId: RunId): boolean { return this.handles.has(runId) }

  /**
   * 启动消费循环。先 stop 同 ID 的旧循环，避免重复订阅。
   * @param after 登录流的起始序号；匿名流固定 0
   */
  private start(runId: RunId, callbacks: RunTransportCallbacks & { kind: Handle['kind'] }, after: number, run: RunRecord, input?: Parameters<AiApi['anonymousStream']>[0], image?: Blob): void {
    this.stop(runId)
    const handle: Handle = { controller: new AbortController(), kind: callbacks.kind, runId }; this.handles.set(runId, handle)
    const consume = async (): Promise<void> => {
      let attempt = 0
      let restartedFromZero = after === 0
      while (!handle.controller.signal.aborted) {
        callbacks.onConnection?.(attempt ? 'backoff' : 'connecting', attempt)
        try {
          const stream = callbacks.kind === 'login'
            ? this.api.subscribeRun(runId, after, handle.controller.signal, () => callbacks.onConnection?.('open', attempt))
            : this.api.anonymousStream(input!, image, handle.controller.signal)
          if (callbacks.kind === 'anonymous') callbacks.onConnection?.('open', attempt)
          for await (const event of stream) {
            if (event.seq <= after) continue
            if (event.seq !== after + 1) throw new RunEventGapError(after + 1, event.seq)
            callbacks.onEvent(event)
            after = event.seq
            if (terminalTypes.has(event.type)) { callbacks.onConnection?.('closed', attempt); this.stop(handle.runId); return }
          }
          if (handle.controller.signal.aborted) return
          /* 匿名流是一次性请求：无终态事件就结束了属于异常中断，必须上报，否则界面会一直停在「正在回应」。 */
          if (callbacks.kind === 'anonymous') { callbacks.onError?.(new Error('连接中断，这次回答没有完成')); this.stop(handle.runId); return }
          throw new Error('SSE connection closed')
        } catch (error) {
          if (handle.controller.signal.aborted) return
          if (callbacks.kind === 'anonymous') { callbacks.onError?.(error instanceof Error ? error : new Error('匿名流连接失败')); this.stop(handle.runId); return }
          const historyLost = error instanceof RunEventGapError || (error instanceof V2HttpError && error.apiError.code === 'RUN_EVENT_HISTORY_LOST')
          if (historyLost && !restartedFromZero) {
            callbacks.onReset?.()
            after = 0
            attempt = 0
            restartedFromZero = true
            continue
          }
          const terminal = await this.reconcileTerminal(runId, after, handle.controller.signal)
          if (terminal) {
            callbacks.onEvent(terminal)
            callbacks.onConnection?.('closed', attempt)
            this.stop(handle.runId)
            return
          }
          attempt += 1
          if (attempt > backoff.length) {
            callbacks.onError?.(error instanceof Error ? error : new Error('连接多次失败，请手动重连'))
            this.stop(handle.runId)
            return
          }
          callbacks.onConnection?.('backoff', attempt); const delay = backoff[attempt - 1] ?? 10000
          await new Promise<void>(resolve => { const finish = (): void => { handle.timer = undefined; handle.wakeDelay = undefined; resolve() }; handle.wakeDelay = finish; handle.timer = setTimeout(finish, delay) })
        }
      }
    }
    void consume().catch(error => callbacks.onError?.(error instanceof Error ? error : new Error('run transport failed')))
  }

  /**
   * SSE 异常断开时查 REST。若 Mongo 已是终态，合成一帧终端事件，避免界面卡在「正在回应」。
   */
  private async reconcileTerminal(runId: RunId, after: number, signal: AbortSignal): Promise<RunEvent | undefined> {
    try {
      const run = await this.api.getRun(runId)
      if (signal.aborted || !isTerminalRunState(run.state)) return undefined
      const common = { v: 1 as const, seq: after + 1, run_id: run.run_id, conversation_id: run.conversation_id, emitted_at: new Date().toISOString() }
      if (run.state === 'completed') return { ...common, type: 'run.completed', payload: { finished_at: common.emitted_at, finish_reason: 'reconciled', partial: false } }
      if (run.state === 'stopped') return { ...common, type: 'run.stopped', payload: { finished_at: common.emitted_at, finish_reason: 'stopped', partial: true } }
      return { ...common, type: 'run.failed', payload: { code: run.state === 'interrupted' ? 'RUN_RECOVERED_INTERRUPTED' : 'RUN_RECONCILED_FAILED', retryable: run.state === 'interrupted', partial: true } }
    } catch {
      return undefined
    }
  }
}

/** 公开序号不连续。expected 是本地 lastSeq+1，received 是实际帧。 */
export class RunEventGapError extends Error {
  constructor(readonly expected: number, readonly received: number) {
    super(`事件序号不连续：期望 ${expected}，实际 ${received}`)
    this.name = 'RunEventGapError'
  }
}
