<script setup lang="ts">
import type { IndexJob } from '@/api/agentIndexAdmin'
defineProps<{
  /** busy：当前请求进行中，禁止重复提交或不安全的页面切换。 */
  busy: boolean;
  /** error：当前资源的可读错误提示，不能当作空结果。 */
  error: string;
  /** requestKey：尚待人工核对的原幂等键，重试时必须保持不变。 */
  requestKey: string;
  /** job：服务端已经确认接纳的任务头部。 */
  job: IndexJob | null
}>()
defineEmits<{
  /** retry：人工要求重放相同幂等请求。 */
  retry: [];
  /** reviewed：管理员已核对结果，可以清除待核对键。 */
  reviewed: []
}>()
</script>
<template>
  <div v-if="error || job" class="index-feedback" aria-live="polite">
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <template v-if="requestKey"><p class="admin-mono">请求标识：{{ requestKey }}</p><p>请先<RouterLink to="/admin/agent/index-jobs">查看任务列表</RouterLink>核对结果。重试将使用相同标识和原始参数。</p><a-space wrap><a-button :loading="busy" @click="$emit('retry')">按原请求核对 / 重试</a-button><a-button :disabled="busy" @click="$emit('reviewed')">已核对，结束本次请求</a-button></a-space></template>
    <RouterLink v-if="job" :to="`/admin/agent/index-jobs/${job.id}`">查看任务 · {{ job.counts.total }} 篇 · {{ job.mode === 'force' ? '强制重建' : '建立索引' }}</RouterLink>
  </div>
</template>
<style scoped>.index-feedback { display: grid; gap: 8px; margin-top: 12px; overflow-wrap: anywhere; }.index-feedback p { margin: 0; }</style>
