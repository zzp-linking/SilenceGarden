import { agentChatApi } from '@/api/agentChat'
import { V2HttpError } from '@/api/clientV2'
import { applyEvent, terminal, type AgentEvent, type AgentRun } from './model'

/** 网络状态与运行状态分开维护；EOF 不代表运行完成。 */
export type ConnectionState = 'connected' | 'reconnecting' | 'failed' | 'closed'
/** 每个运行观察者仅在所属账号和工作区世代内有效。 */
export interface RunObserver {
  update: (run: AgentRun) => void // 按渲染批次接收不可变副本。
  connection: (state: ConnectionState) => void // 仅反馈网络连接状态。
  gone: (code: string) => void // 进程世代、资源或认证状态发生变化。
}

/** 运行时校验避免应用其他协议帧或无效序号。 */
function parseFrame(block: string): AgentEvent | null {
  const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
  if (!data) return null
  const e = JSON.parse(data) as Partial<AgentEvent>
  if (e.v !== 1 || !Number.isSafeInteger(e.seq) || (e.seq ?? 0) < 1 || typeof e.run_id !== 'string' || typeof e.chat_id !== 'string' || typeof e.instance_id !== 'string' || typeof e.type !== 'string' || !e.payload || typeof e.payload !== 'object') throw new Error('运行事件格式不正确')
  if (e.payload.text !== undefined && typeof e.payload.text !== 'string') throw new Error('增量格式不正确')
  return e as AgentEvent
}

/** 支持取消的有界退避；销毁时同时移除计时器及监听器。 */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
    if (signal.aborted) finish()
  })
}

/** 订阅跟随运行标识，与当前选中的会话独立。 */
export class RunSubscription {
  private readonly lifetime = new AbortController() // 账号和工作区的生命周期，也覆盖退避等待。
  private batchTimer: ReturnType<typeof setTimeout> | undefined // 每 50 毫秒最多触发一次渲染。
  private run: AgentRun // 内存中最新且序号连续的真实运行状态。

  constructor(initial: AgentRun, private readonly observer: RunObserver) { this.run = { ...initial } }

  /** 只关闭浏览器资源，不提交停止模型请求。 */
  close(): void { this.lifetime.abort(); clearTimeout(this.batchTimer); this.batchTimer = undefined }

  /** 发布真实状态副本；store 另用世代校验阻止旧工作区回调写入。 */
  private flush(): void { clearTimeout(this.batchTimer); this.batchTimer = undefined; if (!this.lifetime.signal.aborted) this.observer.update({ ...this.run }) }

  /** 使用有界帧缓冲读取 SSE，读取超时大于 15 秒心跳间隔。 */
  private async read(): Promise<void> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    this.lifetime.signal.addEventListener('abort', abort, { once: true })
    let idle: ReturnType<typeof setTimeout> | undefined
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      idle = setTimeout(abort, 45000)
      const response = await agentChatApi.events(this.run.instance_id, this.run.run_id, this.run.event_seq, controller.signal)
      if (!response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) throw new Error('流式连接格式不正确')
      reader = response.body.getReader()
      this.observer.connection('connected')
      const decoder = new TextDecoder()
      let buffer = ''
      while (!controller.signal.aborted) {
        const next = await reader.read()
        clearTimeout(idle); idle = setTimeout(abort, 45000)
        if (next.done) break
        buffer += decoder.decode(next.value, { stream: true })
        if (buffer.length > 1024 * 1024) throw new Error('SSE 帧过长')
        const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const event = parseFrame(block)
          if (!event) continue
          if (applyEvent(this.run, event) === 'gap') throw new Error('SSE_GAP')
          if (terminal(this.run.status)) { this.flush(); return }
          this.batchTimer ??= setTimeout(() => this.flush(), 50)
        }
      }
      this.flush()
      if (!terminal(this.run.status)) throw new Error('流连接断开')
    } finally {
      clearTimeout(idle); controller.abort(); await reader?.cancel().catch(() => undefined)
      this.lifetime.signal.removeEventListener('abort', abort)
    }
  }

  /** 回放重试不会创建运行；窗口过期或序号缺口通过原子快照替换恢复。 */
  async start(): Promise<void> {
    let attempts = 0
    let snapshot = false
    while (!this.lifetime.signal.aborted && !terminal(this.run.status)) {
      try {
        if (snapshot) { this.run = await agentChatApi.run(this.run.instance_id, this.run.run_id, this.lifetime.signal); this.flush(); snapshot = false }
        if (terminal(this.run.status)) break
        await this.read()
        attempts = 0
      } catch (error) {
        if (this.lifetime.signal.aborted) return
        this.flush()
        if (error instanceof V2HttpError && [401, 403, 404, 410].includes(error.status)) { this.observer.gone(error.apiError.code); return }
        snapshot = !(error instanceof V2HttpError) || error.apiError.code === 'AGENT_REPLAY_EXPIRED'
        if (++attempts > 8) { this.observer.connection('failed'); return }
        this.observer.connection('reconnecting')
        await pause(Math.min(15000, 500 * 2 ** attempts), this.lifetime.signal)
      }
    }
    if (!this.lifetime.signal.aborted) { this.flush(); this.observer.connection('closed') }
  }
}
