import { aiApi } from '@/api/chat'
import { RunTransportManager } from '@/transport/runTransportManager'

export const runTransportManager = new RunTransportManager(aiApi)
