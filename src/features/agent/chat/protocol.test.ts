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
  it('按计划版本合并 SSE，较旧计划不覆盖已确认事实', async () => {
    const steps = [{ step_id: 1, kind: 'export', status: 'completed' }, { step_id: 2, kind: 'answer', status: 'pending' }] as const
    vi.mocked(agentChatApi.events).mockResolvedValue(response([
      event(1, 'run.plan', { plan_version: 3, steps: steps.map(step => ({ ...step })) }),
      event(2, 'run.plan', { plan_version: 1, steps: steps.map(step => ({ ...step, status: 'pending' })) }),
      event(3, 'run.stopped', { status: 'stopped' }),
      event(4, 'run.persistence', { persistence_status: 'saved' })
    ]))
    const update = vi.fn()
    const sub = new RunSubscription({ ...run(), persistence_status: 'pending' }, { update, connection: vi.fn(), gone: vi.fn() })
    await sub.start()
    expect(update.mock.lastCall?.[0]).toMatchObject({ event_seq: 4, plan: { plan_version: 3, steps } })
    sub.close()
  })
  it('按序恢复工具动作，终态清空动作并保留服务端引用', async () => {
    const source = { id: 's1', title: '组件手册', document_id: 'd1', chunk_id: 'c1', index_version_id: 'v1' }
    vi.mocked(agentChatApi.events).mockResolvedValue(response([
      event(1, 'run.activity', { activity: 'tool_running', tool_name: 'knowledge_search' }),
      event(2, 'run.activity', { activity: 'model_processing' }),
      event(3, 'run.completed', { status: 'completed', sources: [source] })
    ]))
    const update = vi.fn()
    const sub = new RunSubscription(run(), { update, connection: vi.fn(), gone: vi.fn() })
    await sub.start()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ event_seq: 1, activity: 'tool_running', tool_name: 'knowledge_search' }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ event_seq: 2, activity: 'model_processing', tool_name: undefined }))
    expect(update.mock.lastCall?.[0]).toMatchObject({ activity: undefined, tool_name: undefined, sources: [source] })
    sub.close()
  })
  it('回放旧运行时保留已保存的超过五十条引用', async () => {
    const sources = Array.from({ length: 55 }, (_, index) => ({
      id: `s${index + 1}`, title: '旧来源', document_id: 'd1', chunk_id: `c${index + 1}`, index_version_id: 'v1'
    }))
    vi.mocked(agentChatApi.events).mockResolvedValue(response([event(1, 'run.incomplete', { status: 'incomplete', sources })]))
    const update = vi.fn()
    const sub = new RunSubscription(run(), { update, connection: vi.fn(), gone: vi.fn() })
    await sub.start()
    expect(update.mock.lastCall?.[0]).toMatchObject({ event_seq: 1, sources })
    sub.close()
  })
  it('收到工具轮撤回后清空临时正文，后续只累积正式回答', async () => {
    vi.mocked(agentChatApi.events).mockResolvedValue(response([
      event(1, 'answer.delta', { text: '临时正文' }),
      event(2, 'answer.reset', {}),
      event(3, 'run.activity', { activity: 'tool_running', tool_name: 'pdf_export' }),
      event(4, 'answer.delta', { text: '正式回答' }),
      event(5, 'run.completed', { status: 'completed' })
    ]))
    const update = vi.fn()
    const sub = new RunSubscription(run(), { update, connection: vi.fn(), gone: vi.fn() })
    await sub.start()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ event_seq: 3, answer: '', tool_name: 'pdf_export' }))
    expect(update.mock.lastCall?.[0]).toMatchObject({ event_seq: 5, answer: '正式回答', status: 'completed' })
    sub.close()
  })
  it('生成终态后继续消费保存事件，保存成功才结束订阅', async () => {
    vi.mocked(agentChatApi.events).mockResolvedValue(response([
      event(1, 'run.completed', { status: 'completed' }),
      event(2, 'run.persistence', { persistence_status: 'saving' }),
      event(3, 'run.persistence', { persistence_status: 'saved' })
    ]))
    const update = vi.fn(); const connection = vi.fn()
    const sub = new RunSubscription({ ...run(), persistence_status: 'pending' }, { update, connection, gone: vi.fn() })
    await sub.start()
    expect(update.mock.lastCall?.[0]).toMatchObject({ status: 'completed', persistence_status: 'saved', event_seq: 3 })
    expect(connection).toHaveBeenLastCalledWith('closed'); sub.close()
  })
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
