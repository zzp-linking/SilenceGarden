import { clientV2 } from './clientV2'
import type { AgentBootstrap, AgentChat, AgentRun, AgentMessage } from '@/features/agent/chat/model'

/** 所有资源访问必须提供进程世代，避免服务重启被误判为普通 404。 */
const query = (instance: string) => `instance_id=${encodeURIComponent(instance)}`
/** 智能体接口复用 V2 Cookie、认证刷新和错误语义。 */
export const agentChatApi = {
  bootstrap: (signal?: AbortSignal) => clientV2.request<AgentBootstrap>('/agent/chat/bootstrap', { signal }),
  list: (instance: string, signal?: AbortSignal, cursor = '') => clientV2.request<{ items: AgentChat[]; next_cursor?: string }>(`/agent/chats?${query(instance)}&cursor=${encodeURIComponent(cursor)}`, { signal }),
  create: (instance: string, signal?: AbortSignal) => clientV2.request<AgentChat>('/agent/chats', { method: 'POST', body: JSON.stringify({ instance_id: instance }), signal }),
  get: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${id}?${query(instance)}`, { signal }),
  rename: (instance: string, chat: AgentChat, title: string, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${chat.chat_id}`, { method: 'PATCH', body: JSON.stringify({ instance_id: instance, revision: chat.revision, title }), signal }),
  remove: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${id}?${query(instance)}`, { method: 'DELETE', signal }),
  /** download 与 exportFile 分别表示用户明确授予的单轮下载与导出权限。 */
  send: (instance: string, id: string, text: string, key: string, signal?: AbortSignal, thinking = false, download = false, exportFile = false) => clientV2.request<AgentRun>(`/agent/chats/${id}/runs`, { method: 'POST', body: JSON.stringify({ instance_id: instance, text, client_request_id: key, thinking_requested: thinking, allow_file_download: download || undefined, allow_file_export: exportFile || undefined }), signal }),
  preference: (chat: AgentChat, thinking: boolean, signal?: AbortSignal) => clientV2.request<AgentChat>(`/agent/chats/${chat.chat_id}`, { method: 'PATCH', body: JSON.stringify({ revision: chat.revision, thinking_preference: thinking }), signal }),
  messages: (id: string, before: number, signal?: AbortSignal) => clientV2.request<{ items: AgentMessage[]; next_cursor?: number; watermark: number }>(`/agent/chats/${id}/messages?before_seq=${before}&limit=40`, { signal }),
  /** 按附件 ID 读取文件，访问 Cookie 过期时沿用会话刷新和一次重试。 */
  downloadAsset: (id: string, signal?: AbortSignal) => clientV2.requestRaw(`/agent/assets/${encodeURIComponent(id)}/download`, { signal }),
  save: (id: string, signal?: AbortSignal) => clientV2.request<AgentRun>(`/agent/runs/${id}/save`, { method: 'POST', body: '{}', signal }),
  active: (instance: string, signal?: AbortSignal) => clientV2.request<{ items: AgentRun[] }>(`/agent/runs/active?${query(instance)}`, { signal }),
  run: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentRun>(`/agent/runs/${id}?${query(instance)}`, { signal }),
  stop: (instance: string, id: string, signal?: AbortSignal) => clientV2.request<AgentRun>(`/agent/runs/${id}/stop`, { method: 'POST', body: JSON.stringify({ instance_id: instance }), signal }),
  events: (instance: string, id: string, after: number, signal: AbortSignal) => clientV2.requestRaw(`/agent/runs/${id}/events?${query(instance)}&after=${after}`, { signal, headers: { Accept: 'text/event-stream' } })
}
