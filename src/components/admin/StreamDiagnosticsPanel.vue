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
	<section class="stream-panel" aria-labelledby="stream-diagnostics-title">
		<header class="stream-head">
			<div>
				<span class="stream-eyebrow">Redis-first SSE</span>
				<h2 id="stream-diagnostics-title">流式连接诊断</h2>
			</div>
			<span class="process-note">进程重启后重新计数</span>
		</header>
		<div class="stream-grid">
			<article><small>当前连接</small><strong>{{ diagnostics.current_connections }}</strong><span>累计 {{ diagnostics.total_connections }}</span></article>
			<article><small>断点重连</small><strong>{{ diagnostics.reconnects }}</strong><span>从零回放 {{ diagnostics.replay_from_zero }}</span></article>
			<article><small>回放事件</small><strong>{{ diagnostics.replayed_events }}</strong><span>请求 {{ diagnostics.replay_requests }}</span></article>
			<article><small>慢连接断开</small><strong>{{ diagnostics.slow_connection_disconnects }}</strong><span>不阻塞其他连接</span></article>
			<article><small>最长回放</small><strong>{{ diagnostics.replay_duration_max_ms }} ms</strong><span>平均 {{ averageReplayMS }} ms</span></article>
			<article><small>首段文字延迟</small><strong>{{ diagnostics.first_text_latency_max_ms }} ms</strong><span>平均 {{ averageFirstTextMS }} ms</span></article>
		</div>
		<h3>Redis 事件写入</h3>
		<div class="stream-grid write-grid">
			<article><small>写入请求</small><strong>{{ diagnostics.redis_append_requests }}</strong><span>成功 {{ diagnostics.redis_append_successes }} · 失败 {{ diagnostics.redis_append_failures }}</span></article>
			<article><small>实际新增事件</small><strong>{{ diagnostics.redis_appended_events }}</strong><span>{{ diagnostics.redis_appended_bytes }} 字节</span></article>
			<article><small>最长写入</small><strong>{{ diagnostics.redis_append_duration_max_ms }} ms</strong><span>平均 {{ averageAppendMS }} ms</span></article>
			<article><small>事件冲突</small><strong>{{ diagnostics.event_id_conflicts }}</strong><span>序号冲突 {{ diagnostics.public_sequence_conflicts }}</span></article>
			<article><small>序号缺口</small><strong>{{ diagnostics.public_sequence_gaps }}</strong><span>容量超限 {{ diagnostics.capacity_exceeded }}</span></article>
		</div>
		<h3>最终保存与恢复</h3>
		<div class="stream-grid finalization-grid">
			<article><small>等待最终保存</small><strong>{{ diagnostics.pending_finalizations }}</strong><span>最久 {{ oldestPendingLabel }}</span></article>
			<article><small>最终保存</small><strong>{{ diagnostics.finalization_successes }}</strong><span>请求 {{ diagnostics.finalization_requests }} · 失败 {{ diagnostics.finalization_failures }}</span></article>
			<article><small>最终保存耗时</small><strong>{{ diagnostics.finalization_duration_max_ms }} ms</strong><span>平均 {{ averageFinalizationMS }} ms</span></article>
			<article><small>消息写入失败</small><strong>{{ diagnostics.mongo_message_commit_failures }}</strong><span>请求 {{ diagnostics.mongo_message_commit_requests }}</span></article>
			<article><small>Run 写入失败</small><strong>{{ diagnostics.mongo_run_commit_failures }}</strong><span>请求 {{ diagnostics.mongo_run_commit_requests }}</span></article>
			<article><small>恢复结果</small><strong>{{ diagnostics.recovery_recovered }}</strong><span>候选 {{ diagnostics.recovery_candidates }} · 失败 {{ diagnostics.recovery_failed }}</span></article>
			<article><small>中断恢复</small><strong>{{ diagnostics.recovery_interrupted }}</strong><span>数据丢失 {{ diagnostics.recovery_data_lost }}</span></article>
			<article><small>停止请求</small><strong>{{ diagnostics.stop_successes }}</strong><span>请求 {{ diagnostics.stop_requests }} · 失败 {{ diagnostics.stop_failures }}</span></article>
			<article><small>停止后拦截</small><strong>{{ diagnostics.post_stop_event_rejections }}</strong><span>Redis 硬分界线</span></article>
		</div>
	</section>
</template>

<style scoped>
.stream-panel { margin-top: 1.5rem; padding: 1.2rem; border: 1px solid #e0e8de; border-radius: 12px; background: #f9fbf8; }
.stream-head { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.stream-head h2 { margin: .25rem 0 0; color: #31533e; font: 1.2rem 'STKaiti', serif; }
.stream-panel h3 { margin: 1.2rem 0 .75rem; color: #52675a; font-size: .82rem; font-weight: 600; }
.stream-eyebrow, .process-note { color: #89978b; font-size: .7rem; }
.stream-eyebrow { letter-spacing: .12em; text-transform: uppercase; }
.stream-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .75rem; }
.stream-grid article { display: grid; gap: .35rem; min-width: 0; padding: .85rem; background: #fff; border-radius: 8px; }
.stream-grid small, .stream-grid span { overflow: hidden; color: #89978b; font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.stream-grid strong { color: #31533e; font: 1.15rem ui-monospace, monospace; }
@media (max-width: 900px) { .stream-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .stream-head { align-items: start; flex-direction: column; } .stream-grid { grid-template-columns: 1fr; } }
</style>
