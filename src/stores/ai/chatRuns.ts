/**
 * 浏览器侧 Run 状态表。
 *
 * - byId 是全量索引：当前对话、后台对话、已终态的旧 Run 都可能还在。
 * - reduceRun 是纯函数：SSE 帧 → 新的 ClientRunState；序号必须连续。
 * - 乐观停止（stopOptimistic）期间只推进 lastSeq，不把增量写回正文。
 */
import { defineStore } from 'pinia'
import { isTerminalRunState } from '@/features/ai/model'
import type { ApiError, ClientRunState, ConversationId, RunEvent, RunId, RunOperation, RunState, TurnId } from '@/features/ai/model'

export interface ChatRunsState {
  /** runId → 流式状态。键是字符串化的 RunId。 */
  byId: Record<string, ClientRunState>
}

/**
 * 把服务端 AcceptedRunRecord / RunRecord 转成空的客户端缓冲。
 * @param run.operation 缺省视为 send
 */
export function createClientRun(run: { run_id: RunId; operation?: RunOperation; conversation_id: ConversationId; turn_id: string; assistant_message_id: string; state: RunState }): ClientRunState {
  return { runId: run.run_id, operation: run.operation ?? 'send', conversationId: run.conversation_id, turnId: run.turn_id as ClientRunState['turnId'], assistantMessageId: run.assistant_message_id as ClientRunState['assistantMessageId'], state: run.state, reasoning: '', answer: '', lastSeq: 0, connection: 'idle', reconnectAttempt: 0, partial: false }
}

/**
 * 把一帧 SSE 折进本地 Run。
 * 丢弃条件：run_id 不符、非 created 时 conversation_id 不符、seq 落后。
 * seq 跳跃则标记 recoveryRequired，由传输层从 0 回放。
 */
export function reduceRun(state: ClientRunState, event: RunEvent): ClientRunState {
  if (event.run_id !== state.runId) return state
  if (event.conversation_id !== state.conversationId && event.type !== 'run.created') return state
  if (event.seq <= state.lastSeq) return state
  if (event.seq !== state.lastSeq + 1) {
    return { ...state, connection: 'closed', recoveryRequired: true }
  }
  if (state.stopOptimistic && !['run.completed', 'run.stopped', 'run.failed'].includes(event.type)) {
    return { ...state, lastSeq: event.seq }
  }
  if (isTerminalRunState(state.state) && !state.stopOptimistic) return state
  const next: ClientRunState = { ...state, lastSeq: Math.max(state.lastSeq, event.seq), recoveryRequired: false }
  switch (event.type) {
    case 'run.created':
      next.conversationId = event.conversation_id
      next.state = event.payload.state
      if (event.payload.turn_id) next.turnId = event.payload.turn_id
      if (event.payload.assistant_message_id) next.assistantMessageId = event.payload.assistant_message_id
      break
    case 'run.status': next.state = event.payload.state; break
    case 'reasoning.delta': next.state = 'running'; next.reasoning += event.payload.delta; break
    case 'answer.delta': next.state = 'running'; next.answer += event.payload.delta; break
    case 'run.completed': next.state = 'completed'; next.connection = 'closed'; next.partial = event.payload.partial; next.stopOptimistic = false; next.terminalError = undefined; break
    case 'run.stopped': next.state = 'stopped'; next.connection = 'closed'; next.partial = true; next.stopOptimistic = false; next.terminalError = undefined; break
    case 'run.failed': next.state = 'failed'; next.connection = 'closed'; next.partial = event.payload.partial; next.stopOptimistic = false; next.terminalError = { code: event.payload.code, message: event.payload.code, retryable: event.payload.retryable }; break
    case 'usage.final': break
    case 'title.updated': break
    default: { const exhaustive: never = event; return exhaustive }
  }
  return next
}

/**
 * 按服务端顺序把同一 Run 的事件折叠到局部快照。
 * 中途不写响应式 state；调用方在全部事件处理完后只提交一次。
 */
export function reduceRunBatch(state: ClientRunState, events: readonly RunEvent[]): ClientRunState {
  let next = state
  for (const event of events) next = reduceRun(next, event)
  return next
}

export const useChatRunsStore = defineStore('chatRuns', {
  state: (): ChatRunsState => ({ byId: {} }),
  getters: {
    active: state => Object.values(state.byId).filter(run => !isTerminalRunState(run.state))
  },
  actions: {
    register(run: Parameters<typeof createClientRun>[0]): ClientRunState { const next = createClientRun(run); this.byId[next.runId] = next; return next },
    /** 已绑定服务端 run_id 后的常规 ingest。找不到对应缓冲则忽略。 */
    ingest(event: RunEvent): void { this.ingestBatch([event]) },
    /**
     * 原子提交同一 Run 的一批有序事件。返回提交后的快照，供 Conversation 只投影一次。
     */
    ingestBatch(events: readonly RunEvent[]): ClientRunState | undefined {
      const first = events[0]
      if (!first) return undefined
      if (events.some(event => event.run_id !== first.run_id)) throw new Error('Run event batch must contain exactly one run_id')
      const current = this.byId[first.run_id]
      if (!current) return undefined
      const next = reduceRunBatch(current, events)
      this.byId[first.run_id] = next
      return next
    },
    /** 匿名流在本地用 client_request_id 占位，首个 run.created 带来服务端 run/conversation/turn id。 */
    adoptServerCreated(localRunId: RunId, event: RunEvent, localTurnId?: TurnId): ClientRunState | undefined {
      if (event.type !== 'run.created') return undefined
      const current = this.byId[localRunId] ?? this.byId[event.run_id]
      if (!current) return undefined
      const reduced = reduceRun({ ...current, runId: event.run_id, conversationId: event.conversation_id }, event)
      // 匿名 regenerate 的服务端协议仍会签发新 turn_id；页面模型必须继续挂在原 Turn。
      const next = localTurnId ? { ...reduced, turnId: localTurnId } : reduced
      if (localRunId !== event.run_id) delete this.byId[localRunId]
      this.byId[event.run_id] = next
      return next
    },
    setConnection(runId: RunId, connection: ClientRunState['connection'], reconnectAttempt = 0): void {
      const current = this.byId[runId]
      if (!current) return
      this.byId[runId] = {
        ...current,
        connection,
        reconnectAttempt,
        terminalError: connection === 'connecting' || connection === 'open' ? undefined : current.terminalError
      }
    },
    /** 从零回放前必须先丢弃临时拼接结果，避免同一正文被追加两次。 */
    resetForReplay(runId: RunId): void {
      const current = this.byId[runId]
      if (current) this.byId[runId] = { ...current, reasoning: '', answer: '', lastSeq: 0, recoveryRequired: false, terminalError: undefined }
    },
    setError(runId: RunId, error: ApiError): void { const current = this.byId[runId]; if (current) this.byId[runId] = { ...current, connection: 'closed', terminalError: error } },
    /**
     * 用户点停止后立刻把 UI 切到 stopped。
     * @returns 停止前的真实状态，失败时用来回滚；已终态则返回 undefined。
     */
    markStopping(runId: RunId): RunState | undefined {
      const current = this.byId[runId]
      if (!current || isTerminalRunState(current.state)) return undefined
      const previous = current.state
      this.byId[runId] = { ...current, state: 'stopped', connection: 'closed', partial: true, stopOptimistic: true, terminalError: undefined }
      return previous
    },
    /** cancel 接口失败且无法 getRun 时，把乐观停止滚回 previous。 */
    restoreAfterStopFailure(runId: RunId, previous: RunState): void {
      const current = this.byId[runId]
      if (current?.stopOptimistic) this.byId[runId] = { ...current, state: previous, stopOptimistic: false, partial: false }
    },
    /** 用 REST 的 MongoDB 状态纠正乐观停止或 Redis 过期后的本地状态。 */
    reconcileRun(run: { run_id: RunId; state: RunState }): void {
      const current = this.byId[run.run_id]
      if (!current) return
      this.byId[run.run_id] = {
        ...current,
        state: run.state,
        connection: isTerminalRunState(run.state) ? 'closed' : 'idle',
        stopOptimistic: false,
        terminalError: undefined
      }
    },
    /** 匿名流没有服务端回执，停止时需要在本地落终态，否则状态行会一直停在「正在回应」。 */
    markStopped(runId: RunId): void { const current = this.byId[runId]; if (current && (!isTerminalRunState(current.state) || current.stopOptimistic)) this.byId[runId] = { ...current, state: 'stopped', connection: 'closed', partial: true, stopOptimistic: false } },
    remove(runId: RunId): void { delete this.byId[runId] },
    /** 登录态切换时清空全部 Run，避免把上一个用户的流写进新会话。 */
    clear(): void { this.byId = {} }
  }
})
