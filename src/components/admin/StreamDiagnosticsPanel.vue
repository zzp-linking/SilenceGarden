<script setup lang="ts">
import { computed } from 'vue'
import type { StreamDiagnostics } from '@/types/admin'

const props = defineProps<{
	diagnostics: StreamDiagnostics
}>()

// 后端只上报累计耗时和次数，平均值由展示层即时计算。
const averageReplayMS = computed(() => {
	if (props.diagnostics.replay_requests === 0) return 0
	return Math.round(props.diagnostics.replay_duration_total_ms / props.diagnostics.replay_requests)
})

const averageAppendMS = computed(() => {
	if (props.diagnostics.redis_append_requests === 0) return 0
	return Math.round(props.diagnostics.redis_append_duration_total_ms / props.diagnostics.redis_append_requests)
})

const averageFinalizationMS = computed(() => {
	if (props.diagnostics.finalization_requests === 0) return 0
	return Math.round(props.diagnostics.finalization_duration_total_ms / props.diagnostics.finalization_requests)
})

const oldestPendingLabel = computed(() => {
	const totalSeconds = Math.floor(props.diagnostics.oldest_pending_age_ms / 1_000)
	if (totalSeconds < 60) return `${totalSeconds} 秒`
	return `${Math.floor(totalSeconds / 60)} 分 ${totalSeconds % 60} 秒`
})

const averageFirstTextMS = computed(() => {
	if (props.diagnostics.first_text_events === 0) return 0
	return Math.round(props.diagnostics.first_text_latency_total_ms / props.diagnostics.first_text_events)
})
</script>
<template>
  <a-card title="流式连接诊断" :bordered="false">
    <template #extra><a-typography-text type="secondary">进程重启后重新计数</a-typography-text></template>
    <a-collapse :default-active-key="['connections']" ghost>
      <a-collapse-panel key="connections" header="连接与回放" force-render>
        <a-row :gutter="[24, 24]">
          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="当前连接" :value="diagnostics.current_connections" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">累计 {{ diagnostics.total_connections }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="断点重连" :value="diagnostics.reconnects" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">从零回放 {{ diagnostics.replay_from_zero }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="回放事件" :value="diagnostics.replayed_events" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">请求 {{ diagnostics.replay_requests }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="慢连接断开" :value="diagnostics.slow_connection_disconnects" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">不阻塞其他连接</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="最长回放" :value="diagnostics.replay_duration_max_ms" suffix="ms" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">平均 {{ averageReplayMS }} ms</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="首段文字延迟" :value="diagnostics.first_text_latency_max_ms" suffix="ms" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">平均 {{ averageFirstTextMS }} ms</p></a-col>
        </a-row>
      </a-collapse-panel>
      <a-collapse-panel key="redis" header="Redis 事件写入" force-render>
        <a-row :gutter="[24, 24]">
          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="写入请求" :value="diagnostics.redis_append_requests" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">成功 {{ diagnostics.redis_append_successes }} · 失败 {{ diagnostics.redis_append_failures }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="实际新增事件" :value="diagnostics.redis_appended_events" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">{{ diagnostics.redis_appended_bytes }} 字节</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="最长写入" :value="diagnostics.redis_append_duration_max_ms" suffix="ms" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">平均 {{ averageAppendMS }} ms</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="事件冲突" :value="diagnostics.event_id_conflicts" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">序号冲突 {{ diagnostics.public_sequence_conflicts }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="序号缺口" :value="diagnostics.public_sequence_gaps" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">容量超限 {{ diagnostics.capacity_exceeded }}</p></a-col>
        </a-row>
      </a-collapse-panel>
      <a-collapse-panel key="finalization" header="最终保存与恢复" force-render>
        <a-row :gutter="[24, 24]">
          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="等待最终保存" :value="diagnostics.pending_finalizations" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">最久 {{ oldestPendingLabel }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="最终保存" :value="diagnostics.finalization_successes" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">请求 {{ diagnostics.finalization_requests }} · 失败 {{ diagnostics.finalization_failures }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="最终保存耗时" :value="diagnostics.finalization_duration_max_ms" suffix="ms" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">平均 {{ averageFinalizationMS }} ms</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="消息写入失败" :value="diagnostics.mongo_message_commit_failures" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">请求 {{ diagnostics.mongo_message_commit_requests }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="Run 写入失败" :value="diagnostics.mongo_run_commit_failures" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">请求 {{ diagnostics.mongo_run_commit_requests }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="恢复结果" :value="diagnostics.recovery_recovered" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">候选 {{ diagnostics.recovery_candidates }} · 失败 {{ diagnostics.recovery_failed }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="中断恢复" :value="diagnostics.recovery_interrupted" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">数据丢失 {{ diagnostics.recovery_data_lost }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="停止请求" :value="diagnostics.stop_successes" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">请求 {{ diagnostics.stop_requests }} · 失败 {{ diagnostics.stop_failures }}</p></a-col>

          <a-col :xs="24" :sm="12" :xl="6"><a-statistic title="停止后拦截" :value="diagnostics.post_stop_event_rejections" suffix="" :value-style="{ fontSize: '22px' }" /><p class="diagnostic-note">Redis 硬分界线</p></a-col>
        </a-row>
      </a-collapse-panel>
    </a-collapse>
  </a-card>
</template>

<style scoped>
.diagnostic-note { margin: 8px 0 0; color: #8c8c8c; font-size: 13px; overflow-wrap: anywhere; }
</style>
