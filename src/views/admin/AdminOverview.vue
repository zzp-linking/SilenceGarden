<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { formatAdminTime, formatAdminDate } from '@/utils/adminDisplay'
import { adminApi } from '@/api/admin'
import { useAdminResource } from '@/composables/useAdminResource'
import { microCnyToYuan } from '@/utils/microCny'
import StreamDiagnosticsPanel from '@/components/admin/StreamDiagnosticsPanel.vue'
const { data: usage, loading, error, load } = useAdminResource(() => adminApi.usage())
let timer: ReturnType<typeof setInterval> | undefined
const metrics = computed(() => usage.value ? [
  { title: '今日实际费用', value: microCnyToYuan(usage.value.global.actual_micro_cny), prefix: '¥', note: '统计日期 ' + formatAdminDate(usage.value.date) },
  { title: '回答轮数', value: usage.value.global.answer_rounds, note: '活跃任务 ' + usage.value.active_runs },
  { title: 'Token 用量', value: usage.value.global.tokens.output + usage.value.global.tokens.input_cache_hit + usage.value.global.tokens.input_cache_miss, note: '思考 Token ' + usage.value.global.tokens.reasoning },
  { title: '当前预占', value: usage.value.active_reservations, note: '今日失败 ' + usage.value.global.failure_count }
] : [])
onMounted(() => { void load(); timer = setInterval(() => { if (!document.hidden) void load() }, 10_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <section class="admin-page">
    <header class="admin-page-head"><div><h1 class="admin-page-title">服务总览</h1><p class="admin-page-description">查看今日用量、依赖状态与流式运行指标。每 10 秒自动更新。</p></div><a-button :loading="loading" @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button></header>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-skeleton v-if="!usage && loading" active :paragraph="{ rows: 6 }" />
    <template v-if="usage">
      <a-row :gutter="[16, 16]"><a-col v-for="metric in metrics" :key="metric.title" :xs="24" :sm="12" :xl="6"><a-card :bordered="false"><a-statistic :title="metric.title" :value="metric.value" :prefix="metric.prefix" /><p class="metric-note">{{ metric.note }}</p></a-card></a-col></a-row>
      <a-card title="服务状态" :bordered="false">
        <template #extra><a-badge :status="usage.readiness.ready ? 'success' : 'error'" :text="usage.readiness.ready ? '依赖就绪' : '依赖未就绪'" /></template>
        <a-alert v-if="!usage.readiness.ready" type="error" show-icon :message="'未就绪依赖：' + (usage.readiness.failed?.join('、') || '未知')" class="readiness-alert" />
        <a-descriptions :column="{ xs: 1, sm: 2, lg: 3 }">
          <a-descriptions-item label="依赖检查">{{ usage.readiness.ready ? 'Mongo / Redis / RunManager 正常' : '存在异常' }}</a-descriptions-item>
          <a-descriptions-item label="活跃任务">{{ usage.active_runs }}</a-descriptions-item>
          <a-descriptions-item label="最近更新">{{ formatAdminTime(usage.global.updated_at) }}</a-descriptions-item>
        </a-descriptions>
      </a-card>
      <StreamDiagnosticsPanel :diagnostics="usage.stream" />
    </template>
    <a-empty v-else-if="!loading && !error" description="暂无服务数据" />
  </section>
</template>
<style scoped>
.metric-note { margin: 12px 0 0; color: #8c8c8c; font-size: 13px; }
.readiness-alert { margin-bottom: 16px; }
</style>
