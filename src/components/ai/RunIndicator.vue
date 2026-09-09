<script setup lang="ts">
import { computed } from 'vue'
import type { ClientRunState } from '@/types/ai'
import WhisperRipple from './WhisperRipple.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ run?: ClientRunState }>()
const emit = defineEmits<{ cancel: []; reconnect: [] }>()

const active = computed(() => Boolean(props.run && ['reserved', 'queued', 'running', 'stopping'].includes(props.run.state)))
const canStop = computed(() => Boolean(props.run && ['reserved', 'queued', 'running'].includes(props.run.state)))
const statusText = computed(() => {
  const run = props.run
  if (!run) return ''
  if (run.connection === 'backoff') return `连接中断，将自动重试（第 ${run.reconnectAttempt} 次）`
  if (run.state === 'stopping') return '正在停止'
  if (run.state === 'failed') return '这次回答没有完成'
  return '正在回应'
})
const showRetry = computed(() => Boolean(props.run && props.run.connection === 'closed' && props.run.terminalError?.retryable))
/** 完成/停止属正常终态，不再占用一行状态。 */
const visible = computed(() => Boolean(props.run && (active.value || props.run.state === 'failed' || props.run.connection === 'backoff' || showRetry.value)))
</script>

<template>
  <div v-if="visible" class="run-indicator" role="status">
    <WhisperRipple v-if="active" :size="18" />
    <span class="run-text" :class="{ failed: run?.state === 'failed' }">{{ statusText }}</span>
    <button v-if="canStop" type="button" class="run-button" aria-label="停止生成" @click="emit('cancel')">
      <AppIcon name="square" :size="11" /><span>停止</span>
    </button>
    <button v-if="showRetry" type="button" class="run-button retry" @click="emit('reconnect')">
      <AppIcon name="refresh-cw" :size="12" /><span>重新连接</span>
    </button>
  </div>
</template>

<style scoped>
.run-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  color: var(--whisper-ink-soft);
  font-size: 12.5px;
}
.run-text.failed {
  color: var(--whisper-danger);
}
.run-button {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--whisper-line-strong);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-ink-soft);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease), border-color var(--whisper-duration) var(--whisper-ease);
}
.run-button:hover {
  border-color: var(--whisper-violet);
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.run-button.retry {
  color: var(--whisper-blue-deep);
}
</style>
