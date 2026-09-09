<script setup lang="ts">
import { computed } from 'vue'
import type { RunState } from '@/types/ai'
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
      <WhisperRipple v-if="streaming" :size="16" />
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
  background: linear-gradient(90deg, var(--whisper-ink-soft) 25%, var(--whisper-violet) 50%, var(--whisper-ink-soft) 75%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: whisper-shimmer 1.9s linear infinite;
}
@keyframes whisper-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
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
