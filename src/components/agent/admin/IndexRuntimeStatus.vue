<script setup lang="ts">
import type { IndexRuntimeState } from '@/api/agentIndexAdmin'
defineProps<{
  /** state：最近读取的运行状态快照；null 表示尚无可用快照。 */
  state: IndexRuntimeState | null;
  /** loading：读取请求的加载状态。 */
  loading: boolean;
  /** error：当前资源的可读错误提示，不能当作空结果。 */
  error: string
}>()
defineEmits<{
  /** refresh：要求父级重新读取服务端运行状态。 */
  refresh: []
}>()
/** reasons：将安全的服务端不可用原因映射成中文，不显示部署路径或原生异常。 */
const reasons: Record<string, string> = { disabled: '索引与检索服务未启用', index_schema_unavailable: '索引表尚未就绪', embedding_unavailable: '本地模型未就绪', model_profile_invalid: '模型档案无效', index_config_invalid: '切分档案无效', parser_dependency_unavailable: '解析依赖未就绪', model_space_or_config_mismatch: '档案与当前服务空间不一致', worker_ownership_lost_restart_required: '执行所有权已失效，需要重启服务', worker_owner_held_or_lock_unavailable: '执行锁被占用或不可用', worker_owner_unavailable: '数据库执行所有权不可用', index_storage_unavailable_restart_required: '索引存储不可用，需要重启服务', index_dependencies_unavailable: '索引依赖未就绪', status_unavailable: '状态读取失败', stopping: '服务正在停止' }
</script>
<template>
  <a-card title="索引服务" size="small"><template #extra><a-space wrap><RouterLink to="/admin/agent/index-jobs">全部索引任务</RouterLink><a-button :loading="loading" @click="$emit('refresh')">刷新索引状态</a-button></a-space></template><a-alert v-if="error" type="error" show-icon :message="error" /><a-space v-if="state" wrap><a-tag :color="state.accepting ? 'green' : 'default'">{{ state.accepting ? '可建立索引' : '新建索引暂停' }}</a-tag><a-tag :color="state.retrieval_ready ? 'green' : 'default'">{{ state.retrieval_ready ? '检索可用' : '检索暂停' }}</a-tag><span>排队 {{ state.queued }} · 执行 {{ state.running }}</span><span v-if="state.dimension">{{ state.dimension }} 维</span></a-space><p v-if="state?.reason" class="runtime-reason">{{ reasons[state.reason] || '索引依赖不可用，请查看服务诊断' }}</p><p v-if="state?.profile_id" class="admin-muted admin-mono">档案：{{ state.profile_id }}</p></a-card>
</template>
<style scoped>.runtime-reason { margin: 12px 0 0; }</style>
