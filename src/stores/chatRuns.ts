import { defineStore } from 'pinia'
import { isTerminalRunState } from '@/types/ai'
import type { ApiError, ClientRunState, ConversationId, RunEvent, RunId, RunOperation, RunState } from '@/types/ai'

export interface ChatRunsState { byId: Record<string, ClientRunState> }

export function createClientRun(run: { run_id: RunId; operation?: RunOperation; conversation_id: ConversationId; turn_id: string; assistant_message_id: string; state: RunState }): ClientRunState {
  return { runId: run.run_id, operation: run.operation ?? 'send', conversationId: run.conversation_id, turnId: run.turn_id as ClientRunState['turnId'], assistantMessageId: run.assistant_message_id as ClientRunState['assistantMessageId'], state: run.state, reasoning: '', answer: '', lastSeq: 0, connection: 'idle', reconnectAttempt: 0, partial: false }
}

export function reduceRun(state: ClientRunState, event: RunEvent): ClientRunState {
  if (event.run_id !== state.runId) return state
  if (event.conversation_id !== state.conversationId && event.type !== 'run.created') return state
  const isSnapshot = event.type === 'run.snapshot'
  if (!isSnapshot && event.seq <= state.lastSeq) return state
  if (isSnapshot && event.payload.through_seq < state.lastSeq) return state
  const next: ClientRunState = { ...state, lastSeq: Math.max(state.lastSeq, event.seq) }
  switch (event.type) {
    case 'run.created': next.conversationId = event.conversation_id; next.state = event.payload.state; next.turnId = event.payload.turn_id; next.assistantMessageId = event.payload.assistant_message_id; break
    case 'run.status': next.state = event.payload.state; break
    case 'reasoning.delta': next.state = 'running'; next.reasoning += event.payload.delta; break
    case 'answer.delta': next.state = 'running'; next.answer += event.payload.delta; break
    case 'run.snapshot': next.reasoning = event.payload.reasoning; next.answer = event.payload.answer; next.lastSeq = event.payload.through_seq; break
    case 'run.completed': next.state = 'completed'; next.connection = 'closed'; next.partial = event.payload.partial ?? false; break
    case 'run.stopped': next.state = 'stopped'; next.connection = 'closed'; next.partial = true; break
    case 'run.failed': next.state = 'failed'; next.connection = 'closed'; next.partial = event.payload.partial; next.terminalError = { code: event.payload.code, message: event.payload.code, retryable: event.payload.retryable }; break
    case 'usage.final': break
    case 'title.updated': break
    default: { const exhaustive: never = event; return exhaustive }
  }
  return next
}

export const useChatRunsStore = defineStore('chatRuns', {
  state: (): ChatRunsState => ({ byId: {} }),
  getters: {
    active: state => Object.values(state.byId).filter(run => !isTerminalRunState(run.state))
  },
  actions: {
    register(run: Parameters<typeof createClientRun>[0]): ClientRunState { const next = createClientRun(run); this.byId[next.runId] = next; return next },
    ingest(event: RunEvent): void { const current = this.byId[event.run_id]; if (current) this.byId[event.run_id] = reduceRun(current, event) },
    setConnection(runId: RunId, connection: ClientRunState['connection'], reconnectAttempt = 0): void { const current = this.byId[runId]; if (current) this.byId[runId] = { ...current, connection, reconnectAttempt } },
    setError(runId: RunId, error: ApiError): void { const current = this.byId[runId]; if (current) this.byId[runId] = { ...current, connection: 'closed', state: 'failed', terminalError: error } },
    markStopping(runId: RunId): RunState | undefined {
      const current = this.byId[runId]
      if (!current || isTerminalRunState(current.state) || current.state === 'stopping') return undefined
      const previous = current.state
      this.byId[runId] = { ...current, state: 'stopping', terminalError: undefined }
      return previous
    },
    restoreAfterStopFailure(runId: RunId, previous: RunState): void {
      const current = this.byId[runId]
      if (current?.state === 'stopping') this.byId[runId] = { ...current, state: previous }
    },
    /** 匿名流没有服务端回执，停止时需要在本地落终态，否则状态行会一直停在「正在回应」。 */
    markStopped(runId: RunId): void { const current = this.byId[runId]; if (current && !isTerminalRunState(current.state)) this.byId[runId] = { ...current, state: 'stopped', connection: 'closed', partial: true } },
    remove(runId: RunId): void { delete this.byId[runId] },
    clear(): void { this.byId = {} }
  }
})
