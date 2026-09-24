<script setup lang="ts">
/**
 * 可折叠的思考过程。streaming 时标签做微光；默认收起，避免长推理挤占正文。
 */
import { computed } from 'vue'
import type { RunState } from '@/features/ai/model'
import MarkdownContent from './MarkdownContent.vue'
import WhisperRipple from './WhisperRipple.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ reasoning: string; state?: RunState; defaultExpanded?: boolean }>()
const emit = defineEmits<{ 'copy-code': [code: string] }>()
const expanded = defineModel<boolean>('expanded', { default: false })

const streaming = computed(() => props.state === 'running' || props.state === 'queued' || props.state === 'reserved')
const label = computed(() => streaming.value ? '正在梳理思绪' : props.reasoning ? '思考过程' : '')
</script>

<template>
  <section v-if="reasoning || label" class="reasoning" :class="{ streaming }">
    <button type="button" class="reasoning-toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      <!-- <WhisperRipple v-if="streaming" :size="16" /> -->
      <span class="reasoning-label">{{ label }}</span>
      <AppIcon name="chevron-down" :size="15" class="chevron" :class="{ up: expanded }" />
    </button>
    <div v-if="expanded" class="reasoning-body">
      <MarkdownContent :source="reasoning || '…'" @copy-code="emit('copy-code', $event)" />
    </div>
  </section>
</template>

<style scoped>
.reasoning {
  margin: 8px 0 10px;
  padding: 2px 0 2px 14px;
  border-left: 2px solid var(--whisper-mist-deep);
  color: var(--whisper-ink-soft);
  font-size: 13.5px;
}
.reasoning-toggle {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}
.chevron {
  transition: transform 200ms var(--whisper-ease);
}
.chevron.up {
  transform: rotate(180deg);
}
/* 流式思考：文字微光（reduced-motion 下关闭） */
.streaming .reasoning-label {
  --reasoning-shimmer-highlight: color-mix(
    in srgb,
    var(--whisper-ink-soft) 40%,
    var(--whisper-mist)
  );
  background: linear-gradient(
    90deg,
    var(--whisper-ink-soft) 0%,
    var(--whisper-ink-soft) 32%,
    var(--reasoning-shimmer-highlight) 45%,
    var(--reasoning-shimmer-highlight) 55%,
    var(--whisper-ink-soft) 68%,
    var(--whisper-ink-soft) 100%
  );
  background-size: 300% 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: whisper-shimmer 1.5s linear infinite;
}
@keyframes whisper-shimmer {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}
.reasoning-body {
  padding: 4px 0 4px;
}
@media (prefers-reduced-motion: reduce) {
  .streaming .reasoning-label {
    animation: none;
    background: none;
    color: inherit;
  }
  .chevron {
    transition: none;
  }
}
</style>
