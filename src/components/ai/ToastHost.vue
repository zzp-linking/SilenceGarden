<script setup lang="ts">
import { useToast, type ToastKind } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'
import type { IconName } from './AppIcon.vue'

const { items, dismiss } = useToast()

// 提示类型与图标在宿主集中映射，调用方只需关心语义类型。
const ICONS: Record<ToastKind, IconName> = {
  success: 'check',
  error: 'x',
  info: 'sparkles'
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="item in items" :key="item.id" class="toast" :class="`toast-${item.kind}`" role="status">
          <span class="toast-icon"><AppIcon :name="ICONS[item.kind]" :size="14" /></span>
          <span class="toast-text">{{ item.text }}</span>
          <button type="button" class="toast-close" aria-label="关闭提示" @click="dismiss(item.id)">
            <AppIcon name="x" :size="13" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 16px;
  left: 50%;
  z-index: 90;
  display: grid;
  gap: 8px;
  width: min(420px, calc(100vw - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-menu);
  color: var(--whisper-ink);
  font-size: 13px;
  pointer-events: auto;
}
.toast-icon {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #fff;
}
.toast-success .toast-icon { background: var(--whisper-focus); }
.toast-error .toast-icon { background: var(--whisper-danger); }
.toast-info .toast-icon { background: linear-gradient(135deg, var(--whisper-blue), var(--whisper-violet)); }
.toast-text {
  min-width: 0;
  flex: 1;
  line-height: 1.5;
}
.toast-close {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-faint);
  cursor: pointer;
}
.toast-close:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms var(--whisper-ease), transform 200ms var(--whisper-ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.toast-move {
  transition: transform 200ms var(--whisper-ease);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: none;
  }
}
</style>
