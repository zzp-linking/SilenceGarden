import type { RunState } from './run.types'

export const RUN_STATES = ['reserved', 'queued', 'running', 'completed', 'stopped', 'failed', 'interrupted'] as const satisfies readonly RunState[]
export const TERMINAL_RUN_STATES = ['completed', 'stopped', 'failed', 'interrupted'] as const satisfies readonly RunState[]
export const ACTIVE_RUN_STATES = ['reserved', 'queued', 'running'] as const satisfies readonly RunState[]

/** Run 是否已经进入不会再产生正文增量的终态。 */
export function isTerminalRunState(state: RunState): boolean {
  return (TERMINAL_RUN_STATES as readonly RunState[]).includes(state)
}

/** Run 是否仍占用生成槽位并阻止同轮重复提交。 */
export function isActiveRunState(state: RunState): boolean {
  return (ACTIVE_RUN_STATES as readonly RunState[]).includes(state)
}
