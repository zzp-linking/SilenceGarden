import { RunEventRenderScheduler } from '@/features/ai/streaming/runEventRenderScheduler'

/** 应用级单例：登录 Run 离开 AiChat 页面后仍可继续提交到 store。 */
export const runEventRenderScheduler = new RunEventRenderScheduler()

if (typeof document !== 'undefined') {
  const onVisibilityChange = (): void => runEventRenderScheduler.handleVisibilityChange()
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (import.meta.hot) import.meta.hot.dispose(() => document.removeEventListener('visibilitychange', onVisibilityChange))
}
