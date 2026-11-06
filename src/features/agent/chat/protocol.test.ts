import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentChatApi } from '@/api/agentChat'
import { V2HttpError } from '@/api/clientV2'
import { applyEvent, type AgentEvent, type AgentRun } from './model'
import { RunSubscription } from './subscriptions'

vi.mock('@/api/agentChat', () => ({ agentChatApi: { events: vi.fn(), run: vi.fn() } }))
/** Fresh run snapshot avoids sharing mutable test state. */
function run(): AgentRun { return { run_id: 'r1', chat_id: 'c1', instance_id: 'i1', user_message_id: 'u1', message_id: 'm1', status: 'running', answer: '', reasoning: '', event_seq: 0, model: {} as AgentRun['model'] } }
/** Construct only application-protocol frames, with explicit sequence and identity. */
function event(seq: number, type: string, payload: AgentEvent['payload']): AgentEvent { return { v: 1, instance_id: 'i1', chat_id: 'c1', run_id: 'r1', seq, type, payload } }
/** Simulate fetch streaming boundaries, including Unicode split into arbitrary byte chunks. */
function response(events: AgentEvent[]): Response {
  const bytes = new TextEncoder().encode(events.map(e => `id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`).join(''))
  return new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 71)); c.enqueue(bytes.slice(71)); c.close() } }), { headers: { 'Content-Type': 'text/event-stream' } })
}
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })

describe('Agent factual events and recovery', () => {
  it('isolates run identities, deduplicates contiguous frames and refuses gaps', () => {
    const state = run(); const delta = event(1, 'answer.delta', { text: '答' })
    expect(applyEvent(state, delta)).toBe('applied'); expect(applyEvent(state, delta)).toBe('duplicate')
    expect(applyEvent(state, event(3, 'answer.delta', { text: '丢片' }))).toBe('gap'); expect(state.answer).toBe('答')
    expect(() => applyEvent(state, { ...delta, run_id: 'other' })).toThrow()
  })
  it('consumes split SSE frames and both channels without duplicate answer text', async () => {
    const delta = event(2, 'answer.delta', { text: '答案' })
    vi.mocked(agentChatApi.events).mockResolvedValue(response([event(1, 'reasoning.delta', { text: '思考' }), delta, delta, event(3, 'run.completed', { status: 'completed' })]))
    const update = vi.fn(); const sub = new RunSubscription(run(), { update, connection: vi.fn(), gone: vi.fn() })
    await sub.start(); expect(update.mock.lastCall?.[0]).toMatchObject({ answer: '答案', reasoning: '思考', status: 'completed', event_seq: 3 }); sub.close()
  })
  it('replaces expired replay with an atomic snapshot and continues at its waterline', async () => {
    vi.useFakeTimers()
    vi.mocked(agentChatApi.events).mockRejectedValueOnce(new V2HttpError(409, { code: 'AGENT_REPLAY_EXPIRED', message: 'expired', retryable: false })).mockResolvedValueOnce(response([event(8, 'run.completed', { status: 'completed' })]))
    vi.mocked(agentChatApi.run).mockResolvedValue({ ...run(), answer: '完整快照', reasoning: '快照思考', event_seq: 7 })
    const update = vi.fn(); const sub = new RunSubscription({ ...run(), answer: '旧片段' }, { update, connection: vi.fn(), gone: vi.fn() })
    const done = sub.start(); await vi.advanceTimersByTimeAsync(1100); await done
    expect(agentChatApi.events).toHaveBeenLastCalledWith('i1', 'r1', 7, expect.any(AbortSignal))
    expect(update.mock.lastCall?.[0].answer).toBe('完整快照'); sub.close()
  })
  it('disposes reconnect timers and stops restoring missing/old-generation resources', async () => {
    vi.useFakeTimers(); vi.mocked(agentChatApi.events).mockRejectedValue(new Error('offline'))
    const update = vi.fn(); const sub = new RunSubscription(run(), { update, connection: vi.fn(), gone: vi.fn() })
    const done = sub.start(); await vi.advanceTimersByTimeAsync(1); sub.close(); await vi.advanceTimersByTimeAsync(20000); await done
    expect(agentChatApi.events).toHaveBeenCalledTimes(1); expect(agentChatApi.run).not.toHaveBeenCalled()
    vi.mocked(agentChatApi.events).mockRejectedValue(new V2HttpError(410, { code: 'AGENT_INSTANCE_CHANGED', message: 'restart', retryable: false }))
    const gone = vi.fn(); const next = new RunSubscription(run(), { update, connection: vi.fn(), gone }); await next.start()
    expect(gone).toHaveBeenCalledWith('AGENT_INSTANCE_CHANGED'); next.close()
  })
})
