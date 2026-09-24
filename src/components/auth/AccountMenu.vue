<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import AppIcon from '@/components/ai/AppIcon.vue'
import ChangePasswordDialog from '@/components/auth/ChangePasswordDialog.vue'
import { useAuthSession } from '@/composables/useAuthSession'
import { useToast } from '@/composables/useToast'

const { user, mustChangePassword, loggingOut, logout } = useAuthSession()
const toast = useToast()
const open = shallowRef(false)
const passwordDialogOpen = shallowRef(mustChangePassword.value)

function close(): void {
  open.value = false
}

function toggle(): void {
  if (loggingOut.value) return
  open.value = !open.value
}

async function confirmLogout(): Promise<void> {
  // 先关闭浮层，避免退出期间菜单继续拦截页面交互。
  close()
  await logout()
}

function openPasswordDialog(): void {
  close()
  passwordDialogOpen.value = true
}

function closePasswordDialog(): void {
  if (!mustChangePassword.value) passwordDialogOpen.value = false
}

function passwordChanged(): void {
  passwordDialogOpen.value = false
  toast.success('密码已修改')
}

function onWindowKeydown(event: KeyboardEvent): void {
  // Escape 只关闭当前账号菜单，不触发登出等破坏性操作。
  if (event.key === 'Escape') close()
}

watch(open, (value, _previous, onCleanup) => {
  if (!value) return
  window.addEventListener('keydown', onWindowKeydown)
  onCleanup(() => window.removeEventListener('keydown', onWindowKeydown))
})

watch(mustChangePassword, required => {
  if (required) {
    close()
    passwordDialogOpen.value = true
  }
}, { immediate: true })

onBeforeUnmount(close)
</script>

<template>
  <div class="account-menu">
    <button
      class="account-trigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="account-menu-panel"
      :disabled="loggingOut"
      @click="toggle()"
    >
      <span class="account-trigger-label">{{ user?.account }}</span>
      <AppIcon name="chevron-down" :size="14" />
    </button>
    <div v-if="open" class="menu-scrim" @click="close()"></div>
    <div
      v-if="open"
      id="account-menu-panel"
      class="account-panel"
      role="menu"
      aria-label="账号"
    >
      <button class="menu-button" type="button" role="menuitem" @click="openPasswordDialog">
        <AppIcon name="key-round" :size="15" />
        <span>修改密码</span>
      </button>
      <button class="logout-button" type="button" role="menuitem" :disabled="loggingOut" @click="confirmLogout()">
        <AppIcon name="log-out" :size="14" />
        <span>退出登录</span>
      </button>
    </div>
    <ChangePasswordDialog
      :open="passwordDialogOpen"
      :required="mustChangePassword"
      @close="closePasswordDialog"
      @changed="passwordChanged"
    />
  </div>
</template>

<style scoped>
.account-menu {
  position: relative;
}
.account-trigger {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 7px;
  padding: 4px 13px;
  border: 1px solid var(--whisper-line);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-ink-faint);
  font-size: 11.5px;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease), border-color var(--whisper-duration) var(--whisper-ease);
}
.account-trigger-label {
  overflow: hidden;
  max-width: 132px;
  text-overflow: ellipsis;
}
.account-trigger:hover,
.account-trigger[aria-expanded='true'] {
  border-color: var(--whisper-line-strong);
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.account-trigger:disabled {
  cursor: default;
  opacity: 0.7;
}
.menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 20;
}
.account-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 21;
  display: grid;
  min-width: 168px;
  padding: 6px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-menu);
  transform-origin: top right;
  animation: account-panel-in 160ms var(--whisper-ease);
}
.menu-button,
.logout-button {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  border: 0;
  border-radius: var(--whisper-radius-sm);
  background: transparent;
  color: var(--whisper-ink-soft);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.menu-button:hover,
.menu-button:focus-visible,
.logout-button:hover,
.logout-button:focus-visible {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.menu-button:active,
.logout-button:active {
  transform: scale(0.97);
}
.logout-button:disabled {
  cursor: default;
  opacity: 0.6;
}

@keyframes account-panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .account-trigger,
  .account-panel {
    animation: none;
    transition: none;
  }
}
</style>
