import { aiApi } from '@/api/chat'
import { RunTransportManager } from '@/features/ai/transport/runTransportManager'

/** 进程内单例。AiChat 与登出清理都通过它开关 SSE。 */
export const runTransportManager = new RunTransportManager(aiApi)
