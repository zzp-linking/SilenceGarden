import { clientV2 } from './clientV2'
import type { AgentBootstrap, AgentChat, AgentRun } from '@/features/agent/chat/model'

/** 所有资源访问必须提供进程世代，避免服务重启被误判为普通 404。 */
const query = (instance: string) => `instance_id=${encodeURIComponent(instance)}`
/** 智能体接口复用 V2 Cookie、认证刷新和错误语义。 */
export const agentChatApi = {
  bootstrap: (signal?: AbortSignal) => clientV2.request<AgentBootstrap>('/agent/chat/bootstrap', { signal }),
  list: (instance: string, signal?: AbortSignal) => clientV2.request<{ items: AgentChat[] }>(`/agent/chats?${query(instance)}`, { signal }),
  create: (instance: string, signal?: AbortSignal) => clientV2.request<AgentChat>('/agent/chats', { method: 'POST', body: JSON.stringify({ instance_id: instance }), signal }),
  get: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${id}?${query(instance)}`, { signal }),
  rename: (instance: string, chat: AgentChat, title: string, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${chat.chat_id}`, { method: 'PATCH', body: JSON.stringify({ instance_id: instance, revision: chat.revision, title }), signal }),
  remove: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${id}?${query(instance)}`, { method: 'DELETE', signal }),
  send: (instance: string, id: string, text: string, key: string, signal?: AbortSignal) => clientV2.request<AgentRun>(`/agent/chats/${id}/runs`, { method: 'POST', body: JSON.stringify({ instance_id: instance, text, client_request_id: key }), signal }),
  active: (instance: string, signal?: AbortSignal) => clientV2.request<{ items: AgentRun[] }>(`/agent/runs/active?${query(instance)}`, { signal }),
  run: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentRun>(`/agent/runs/${id}?${query(instance)}`, { signal }),
  stop: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentRun>(`/agent/runs/${id}/stop`, { method: 'POST', body: JSON.stringify({ instance_id: instance }), signal }),
  events: (instance: string, id: string, after: number, signal: AbortSignal) => clientV2.requestRaw(`/agent/runs/${id}/events?${query(instance)}&after=${after}`, { signal, headers: { Accept: 'text/event-stream' } })
}
