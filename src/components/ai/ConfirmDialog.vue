<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>(), { confirmText: '确认', cancelText: '取消' })

const emit = defineEmits<{ confirm: []; cancel: [] }>()

let idSeq = 0
const uid = ++idSeq
const titleId = `confirm-title-${uid}`
const messageId = `confirm-message-${uid}`

const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)

watch(() => props.open, async open => {
  if (!open) return
  await nextTick()
  // 危险操作默认聚焦“取消”，避免误按 Enter 直接确认
  const target = props.danger ? cancelButton.value : confirmButton.value
  target?.focus()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-overlay" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
        <div
          class="dialog-card"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="message ? messageId : undefined"
        >
          <h2 :id="titleId" class="dialog-title">{{ title }}</h2>
          <p v-if="message" :id="messageId" class="dialog-message">{{ message }}</p>
          <slot />
          <div class="dialog-actions">
            <button ref="cancelButton" type="button" class="dialog-button" @click="emit('cancel')">{{ cancelText }}</button>
            <button ref="confirmButton" type="button" class="dialog-button primary" :class="{ danger }" @click="emit('confirm')">{{ confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--whisper-overlay);
}
.dialog-card {
  width: min(400px, 100%);
  padding: 22px 22px 18px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-lg);
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-dialog);
}
.dialog-title {
  margin: 0;
  color: var(--whisper-ink);
  font-family: 'STKaiti', serif;
  font-size: 20px;
  font-weight: 600;
}
.dialog-message {
  margin: 10px 0 0;
  color: var(--whisper-ink-soft);
  font-size: 13.5px;
  line-height: 1.7;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.dialog-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--whisper-line-strong);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-ink-soft);
  font-size: 13.5px;
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease), border-color var(--whisper-duration) var(--whisper-ease);
}
.dialog-button:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.dialog-button.primary {
  border-color: transparent;
  background: linear-gradient(135deg, var(--whisper-blue), var(--whisper-violet));
  color: #fff;
}
.dialog-button.primary:hover {
  filter: brightness(1.06);
  background: linear-gradient(135deg, var(--whisper-blue), var(--whisper-violet));
}
.dialog-button.primary.danger {
  background: var(--whisper-danger);
}
.dialog-button.primary.danger:hover {
  filter: brightness(1.08);
  background: var(--whisper-danger);
}
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 200ms var(--whisper-ease);
}
.dialog-enter-active .dialog-card,
.dialog-leave-active .dialog-card {
  transition: transform 200ms var(--whisper-ease), opacity 200ms var(--whisper-ease);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog-card,
.dialog-leave-to .dialog-card {
  transform: translateY(10px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .dialog-enter-active,
  .dialog-leave-active,
  .dialog-enter-active .dialog-card,
  .dialog-leave-active .dialog-card {
    transition: none;
  }
}
</style>
