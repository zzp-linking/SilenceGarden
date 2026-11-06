<script setup lang="ts">
import type { IndexCounts } from '@/api/agentIndexAdmin'
defineProps<{
  /** counts：由固定成员实际状态聚合的任务计数。 */
  counts: IndexCounts
}>()
</script>
<template><a-space wrap><span>共 {{ counts.total }} 篇</span><a-tag v-if="counts.queued">排队 {{ counts.queued }}</a-tag><a-tag v-if="counts.running" color="blue">执行 {{ counts.running }}</a-tag><a-tag v-if="counts.succeeded" color="green">成功 {{ counts.succeeded }}</a-tag><a-tag v-if="counts.skipped">无需重建 {{ counts.skipped }}</a-tag><a-tag v-if="counts.failed" color="red">失败 {{ counts.failed }}</a-tag><a-tag v-if="counts.interrupted" color="orange">中断 {{ counts.interrupted }}</a-tag></a-space></template>
