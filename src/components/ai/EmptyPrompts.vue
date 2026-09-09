<script setup lang="ts">
import { computed } from 'vue'
import WhisperRipple from './WhisperRipple.vue'
import AppIcon from './AppIcon.vue'

defineProps<{ prompts: string[]; disabled?: boolean }>()
const emit = defineEmits<{ choose: [prompt: string] }>()

/** 随时段变化的简短问候（产品设计文档 §8.3）。 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
</script>

<template>
  <section class="empty-prompts">
    <div class="empty-mark">
      <WhisperRipple :size="72"><span class="mark-seal">语</span></WhisperRipple>
    </div>
    <h1 class="empty-title">{{ greeting }}</h1>
    <p class="empty-sub">把未成形的念头放在这里，让它慢慢长出回答。</p>
    <div class="prompt-grid">
      <button
        v-for="prompt in prompts.slice(0, 4)"
        :key="prompt"
        type="button"
        class="prompt-card"
        :disabled="disabled"
        @click="emit('choose', prompt)"
      >
        <span class="prompt-text">{{ prompt }}</span>
        <AppIcon name="arrow-up-right" :size="14" class="prompt-arrow" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.empty-prompts {
  display: flex;
  width: min(720px, 100%);
  flex-direction: column;
  align-items: center;
  margin: auto;
  padding: 32px 20px;
  text-align: center;
}
.empty-mark {
  margin-bottom: 22px;
}
.mark-seal {
  font-family: 'STKaiti', serif;
  font-size: 20px;
  line-height: 1;
}
.empty-title {
  margin: 0;
  color: var(--whisper-ink);
  font-family: 'STKaiti', serif;
  font-size: clamp(26px, 4vw, 34px);
  font-weight: 500;
  letter-spacing: 0.04em;
}
.empty-sub {
  margin: 12px 0 0;
  color: var(--whisper-ink-soft);
  font-size: 14.5px;
}
.prompt-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 34px;
}
.prompt-card {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: var(--whisper-surface);
  color: var(--whisper-ink-soft);
  font-size: 13.5px;
  line-height: 1.55;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--whisper-duration) var(--whisper-ease), box-shadow var(--whisper-duration) var(--whisper-ease), transform var(--whisper-duration) var(--whisper-ease);
}
.prompt-card:hover {
  border-color: var(--whisper-violet);
  box-shadow: var(--whisper-shadow-card);
  transform: translateY(-1px);
  color: var(--whisper-ink);
}
.prompt-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.prompt-text {
  min-width: 0;
}
.prompt-arrow {
  flex: 0 0 auto;
  color: var(--whisper-ink-faint);
  transition: color var(--whisper-duration) var(--whisper-ease), transform var(--whisper-duration) var(--whisper-ease);
}
.prompt-card:hover .prompt-arrow {
  color: var(--whisper-violet);
  transform: translate(1px, -1px);
}
@media (max-width: 600px) {
  .prompt-grid {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .prompt-card,
  .prompt-arrow {
    transition: none;
  }
}
</style>
