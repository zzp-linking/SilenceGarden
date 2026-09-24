<script setup lang="ts">
/**
 * 用户问题气泡。had_image 只提示「图片仅用于本轮」，原图不回放。
 * 编辑按钮把原文交回输入框，由父级决定 send 还是 edit_and_fork。
 */
import type { UserMessage } from '@/features/ai/model'
import AppIcon from './AppIcon.vue'

defineProps<{ message: UserMessage }>()
const emit = defineEmits<{ edit: [message: UserMessage] }>()
</script>

<template>
  <article class="user-message">
    <div class="user-bubble">
      <p>{{ message.content }}</p>
      <span v-if="message.had_image" class="image-note"><AppIcon name="image" :size="12" /> 图片仅用于本轮</span>
    </div>
    <button type="button" class="edit-button" aria-label="编辑问题" title="编辑并复制为新对话" @click="emit('edit', message)">
      <AppIcon name="pencil" :size="14" />
    </button>
  </article>
</template>

<style scoped>
.user-message {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 6px;
  margin: 20px 0 10px;
}
.user-bubble {
  max-width: 78%;
  padding: 10px 15px;
  border-radius: 20px 20px 6px;
  background: var(--whisper-mist);
  color: var(--whisper-ink);
  font-size: 15px;
  line-height: 1.7;
}
.user-bubble p {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.image-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  color: var(--whisper-ink-faint);
  font-size: 11px;
}
.edit-button {
  display: grid;
  min-width: 32px;
  min-height: 32px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-faint);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--whisper-duration) var(--whisper-ease), background var(--whisper-duration) var(--whisper-ease);
}
.user-message:hover .edit-button,
.user-message:focus-within .edit-button {
  opacity: 1;
}
@media (hover: none) {
  .edit-button {
    opacity: 1;
  }
}
.edit-button:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
@media (prefers-reduced-motion: reduce) {
  .edit-button {
    transition: none;
  }
}
</style>
