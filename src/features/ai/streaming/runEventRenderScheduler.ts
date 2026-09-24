import type { RunEvent, RunId } from '@/features/ai/model'

type TimerHandle = ReturnType<typeof globalThis.setTimeout>
type FrameHandle = number

export type RunEventBatchConsumer = (events: readonly RunEvent[]) => void

export interface RunEventRenderSchedulerOptions {
  visibleIntervalMS?: number
  hiddenIntervalMS?: number
  now?: () => number
  isVisible?: () => boolean
  setTimer?: (callback: () => void, delayMS: number) => TimerHandle
  clearTimer?: (handle: TimerHandle) => void
  requestFrame?: (callback: FrameRequestCallback) => FrameHandle
  cancelFrame?: (handle: FrameHandle) => void
}

interface Channel {
  consumer: RunEventBatchConsumer
  pending: RunEvent[]
  timer?: TimerHandle
  frame?: FrameHandle
  lastFlushAt?: number
}

const terminalTypes = new Set<RunEvent['type']>(['run.completed', 'run.stopped', 'run.failed'])

/**
 * 把高频 RunEvent 合并到有界的 UI 提交批次。
 *
 * 该类不依赖 Vue/Pinia，也不解释 payload；每个 Run 拥有独立队列。
 * terminal 会同步提交并关闭通道，普通事件使用 timer + rAF 调度。
 */
export class RunEventRenderScheduler {
  private readonly channels = new Map<RunId, Channel>()
  private readonly visibleIntervalMS: number
  private readonly hiddenIntervalMS: number
  private readonly now: () => number
  private readonly isVisible: () => boolean
  private readonly setTimer: (callback: () => void, delayMS: number) => TimerHandle
  private readonly clearTimer: (handle: TimerHandle) => void
  private readonly requestFrame: (callback: FrameRequestCallback) => FrameHandle
  private readonly cancelFrame: (handle: FrameHandle) => void

  constructor(options: RunEventRenderSchedulerOptions = {}) {
    this.visibleIntervalMS = options.visibleIntervalMS ?? 50
    this.hiddenIntervalMS = options.hiddenIntervalMS ?? 200
    if (this.visibleIntervalMS < 0 || this.hiddenIntervalMS < 0) throw new Error('render scheduler intervals must be non-negative')

    this.now = options.now ?? (() => globalThis.performance?.now() ?? Date.now())
    this.isVisible = options.isVisible ?? (() => typeof document === 'undefined' || document.visibilityState === 'visible')
    this.setTimer = options.setTimer ?? ((callback, delayMS) => globalThis.setTimeout(callback, delayMS))
    this.clearTimer = options.clearTimer ?? (handle => globalThis.clearTimeout(handle))

    if (options.requestFrame && options.cancelFrame) {
      this.requestFrame = options.requestFrame
      this.cancelFrame = options.cancelFrame
    } else if (typeof globalThis.requestAnimationFrame === 'function' && typeof globalThis.cancelAnimationFrame === 'function') {
      this.requestFrame = callback => globalThis.requestAnimationFrame(callback)
      this.cancelFrame = handle => globalThis.cancelAnimationFrame(handle)
    } else {
      let nextFrame = 0
      const fallbackFrames = new Map<number, TimerHandle>()
      this.requestFrame = callback => {
        const id = ++nextFrame
        const timer = this.setTimer(() => {
          fallbackFrames.delete(id)
          callback(this.now())
        }, 16)
        fallbackFrames.set(id, timer)
        return id
      }
      this.cancelFrame = id => {
        const timer = fallbackFrames.get(id)
        if (timer !== undefined) this.clearTimer(timer)
        fallbackFrames.delete(id)
      }
    }
  }

  /** 为 Run 建立唯一批次通道。重复 open 会先丢弃旧通道，避免旧 consumer 泄漏。 */
  open(runId: RunId, consumer: RunEventBatchConsumer): void {
    this.close(runId, 'discard')
    this.channels.set(runId, { consumer, pending: [] })
  }

  /** 追加一帧；terminal 与之前的待提交事件在同一同步批次中提交。 */
  enqueue(runId: RunId, event: RunEvent): void {
    const channel = this.requireChannel(runId)
    channel.pending.push(event)
    if (terminalTypes.has(event.type)) {
      this.close(runId, 'flush')
      return
    }
    this.schedule(channel)
  }

  /** 立即提交当前队列并取消已经安排的 timer/rAF；通道保持打开。 */
  flushNow(runId: RunId): void {
    const channel = this.channels.get(runId)
    if (!channel) return
    this.cancelScheduled(channel)
    this.flushChannel(runId, channel)
  }

  /** 丢弃未提交事件并保持通道打开，供从零回放复用。 */
  discard(runId: RunId): void {
    const channel = this.channels.get(runId)
    if (!channel) return
    this.cancelScheduled(channel)
    channel.pending = []
    channel.lastFlushAt = undefined
  }

  /** 匿名 run.created 后把完整调度状态迁移到服务端 Run ID。 */
  rebind(from: RunId, to: RunId): void {
    if (from === to) return
    const channel = this.channels.get(from)
    if (!channel) return
    this.cancelScheduled(channel)
    this.close(to, 'discard')
    this.channels.delete(from)
    this.channels.set(to, channel)
    if (channel.pending.length) this.schedule(channel)
  }

  /** 由唯一浏览器适配入口在 visibilitychange 时调用。 */
  handleVisibilityChange(): void {
    for (const [runId, channel] of this.channels) {
      if (!channel.pending.length) continue
      this.cancelScheduled(channel)
      if (this.isVisible()) this.scheduleFrame(runId, channel)
      else this.schedule(channel)
    }
  }

  /** 关闭单 Run 通道；flush 模式保证 pending 在删除前交给 consumer。 */
  close(runId: RunId, mode: 'flush' | 'discard'): void {
    const channel = this.channels.get(runId)
    if (!channel) return
    this.channels.delete(runId)
    this.cancelScheduled(channel)
    const events = channel.pending
    channel.pending = []
    if (mode === 'flush' && events.length) channel.consumer(events)
  }

  closeAll(mode: 'flush' | 'discard'): void {
    for (const runId of [...this.channels.keys()]) this.close(runId, mode)
  }

  has(runId: RunId): boolean {
    return this.channels.has(runId)
  }

  private requireChannel(runId: RunId): Channel {
    const channel = this.channels.get(runId)
    if (!channel) throw new Error(`render scheduler channel is not open: ${runId}`)
    return channel
  }

  private schedule(channel: Channel): void {
    if (!channel.pending.length || channel.timer !== undefined || channel.frame !== undefined) return
    const interval = this.isVisible() ? this.visibleIntervalMS : this.hiddenIntervalMS
    const elapsed = channel.lastFlushAt === undefined ? 0 : Math.max(0, this.now() - channel.lastFlushAt)
    const delay = channel.lastFlushAt === undefined ? interval : Math.max(0, interval - elapsed)
    channel.timer = this.setTimer(() => {
      channel.timer = undefined
      const entry = this.findChannel(channel)
      if (!entry) return
      if (this.isVisible()) this.scheduleFrame(entry[0], channel)
      else this.flushChannel(entry[0], channel)
    }, delay)
  }

  private scheduleFrame(runId: RunId, channel: Channel): void {
    if (channel.frame !== undefined || !channel.pending.length) return
    channel.frame = this.requestFrame(() => {
      channel.frame = undefined
      if (this.channels.get(runId) !== channel) return
      this.flushChannel(runId, channel)
    })
  }

  private flushChannel(runId: RunId, channel: Channel): void {
    if (this.channels.get(runId) !== channel || !channel.pending.length) return
    const events = channel.pending
    channel.pending = []
    channel.lastFlushAt = this.now()
    try {
      channel.consumer(events)
    } finally {
      if (channel.pending.length && this.channels.get(runId) === channel) this.schedule(channel)
    }
  }

  private cancelScheduled(channel: Channel): void {
    if (channel.timer !== undefined) {
      this.clearTimer(channel.timer)
      channel.timer = undefined
    }
    if (channel.frame !== undefined) {
      this.cancelFrame(channel.frame)
      channel.frame = undefined
    }
  }

  private findChannel(channel: Channel): [RunId, Channel] | undefined {
    for (const entry of this.channels) if (entry[1] === channel) return entry
    return undefined
  }
}
