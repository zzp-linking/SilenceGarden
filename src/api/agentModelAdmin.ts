import { clientV2 } from './clientV2'
import type { ModelConfig, ModelInput, ModelTestResult } from '@/features/agent/chat/model'

/** 模型须保存后才能测试，不提供未保存凭据草稿或任意端点接口。 */
const base = '/admin/agent/model-configs'
/** 管理员变更始终携带期望修订号，结果不确定时不自动重复提交。 */
export const agentModelApi = {
  list: () => clientV2.request<{ items: ModelConfig[] }>(base),
  save: (id: string | undefined, form: ModelInput) => clientV2.request<ModelConfig>(id ? `${base}/${id}` : base, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(form) }),
  change: (config: ModelConfig, action: 'activate' | 'deactivate' | 'delete') => clientV2.request<ModelConfig>(`${base}/${config.id}${action === 'delete' ? '' : `/${action}`}`, { method: action === 'delete' ? 'DELETE' : 'POST', body: JSON.stringify({ revision: config.revision }) }),
  test: (config: ModelConfig) => clientV2.request<ModelTestResult>(`${base}/${config.id}/test`, { method: 'POST', body: JSON.stringify({ revision: config.revision }) })
}
