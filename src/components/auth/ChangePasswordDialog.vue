<script setup lang="ts">
import { computed, nextTick, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import { V2HttpError } from '@/api/clientV2'
import AppIcon from '@/components/ai/AppIcon.vue'
import { useUserStore } from '@/stores/user'

const props = defineProps<{ open: boolean; required?: boolean }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const userStore = useUserStore()
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const submitting = shallowRef(false)
const error = shallowRef('')
const currentPasswordInput = useTemplateRef<HTMLInputElement>('currentPasswordInput')
const titleId = 'change-password-title'
const descriptionId = 'change-password-description'

const canSubmit = computed(() => !submitting.value
  && form.currentPassword.length > 0
  && form.newPassword.length >= 8
  && form.newPassword === form.confirmPassword)

function reset(): void {
  form.currentPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  error.value = ''
}

function close(): void {
  if (props.required || submitting.value) return
  reset()
  emit('close')
}

async function submit(): Promise<void> {
  // 服务端成功后统一清空敏感输入，再通知父组件刷新账号状态。
  error.value = ''
  if (!form.currentPassword) {
    error.value = '请输入当前密码。'
    return
  }
  if (form.newPassword.length < 8 || form.newPassword.length > 128) {
    error.value = '新密码长度需为 8–128 位。'
    return
  }
  if (form.newPassword.trim() !== form.newPassword || /[\r\n]/.test(form.newPassword)) {
    error.value = '新密码首尾不能包含空格或换行。'
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    error.value = '两次输入的新密码不一致。'
    return
  }
  if (form.currentPassword === form.newPassword) {
    error.value = '新密码不能与当前密码相同。'
    return
  }

  submitting.value = true
  try {
    await userStore.changePassword(form.currentPassword, form.newPassword)
    reset()
    emit('changed')
  } catch (reason) {
    error.value = reason instanceof V2HttpError
      ? reason.apiError.message
      : '密码修改失败，请稍后再试。'
  } finally {
    submitting.value = false
  }
}

watch(() => props.open, async open => {
  if (!open) {
    reset()
    return
  }
  await nextTick()
  currentPasswordInput.value?.focus()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="password-dialog">
      <div v-if="open" class="dialog-overlay" @click.self="close" @keydown.esc="close">
        <form
          class="dialog-card"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
          @submit.prevent="submit"
        >
          <button
            v-if="!required"
            class="dialog-close"
            type="button"
            aria-label="关闭修改密码弹窗"
            :disabled="submitting"
            @click="close"
          >
            <AppIcon name="x" :size="17" />
          </button>
          <div class="dialog-heading">
            <span class="dialog-icon"><AppIcon name="key-round" :size="19" /></span>
            <div>
              <h2 :id="titleId" class="dialog-title">修改密码</h2>
              <p :id="descriptionId" class="dialog-description">
                {{ required ? '首次登录需要设置新密码后才能继续。' : '修改后，其他设备上的登录状态将失效。' }}
              </p>
            </div>
          </div>

          <div class="password-fields">
            <label class="field-label" for="current-password">旧密码</label>
            <input
              id="current-password"
              ref="currentPasswordInput"
              v-model="form.currentPassword"
              class="password-input"
              type="password"
              autocomplete="current-password"
              placeholder="输入当前使用的密码"
              :disabled="submitting"
            />

            <label class="field-label" for="new-password">新密码</label>
            <input
              id="new-password"
              v-model="form.newPassword"
              class="password-input"
              type="password"
              autocomplete="new-password"
              placeholder="8–128 位，不含首尾空格"
              :disabled="submitting"
            />

            <label class="field-label" for="confirm-password">确认新密码</label>
            <input
              id="confirm-password"
              v-model="form.confirmPassword"
              class="password-input"
              type="password"
              autocomplete="new-password"
              placeholder="再次输入新密码"
              :disabled="submitting"
            />
          </div>

          <p v-if="error" class="form-error" role="alert">{{ error }}</p>

          <div class="dialog-actions">
            <button v-if="!required" class="dialog-button" type="button" :disabled="submitting" @click="close">取消</button>
            <button class="dialog-button primary" type="submit" :disabled="!canSubmit">
              <AppIcon v-if="submitting" class="loading-icon" name="loader-circle" :size="15" />
              <span>{{ submitting ? '修改中…' : '确认修改' }}</span>
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 24px; background: var(--whisper-overlay); }
.dialog-card { position: relative; width: min(420px, 100%); padding: 24px; border: 1px solid var(--whisper-line); border-radius: var(--whisper-radius-lg); background: var(--whisper-surface); box-shadow: var(--whisper-shadow-dialog); }
.dialog-close { position: absolute; top: 14px; right: 14px; display: grid; width: 40px; height: 40px; place-items: center; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--whisper-ink-faint); cursor: pointer; transition: transform 120ms var(--whisper-ease), background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease), opacity var(--whisper-duration) var(--whisper-ease); }
.dialog-close:hover:not(:disabled), .dialog-close:focus-visible { background: var(--whisper-hover); color: var(--whisper-ink); }
.dialog-close:active:not(:disabled) { transform: scale(0.97); }
.dialog-close:disabled { cursor: not-allowed; opacity: 0.45; }
.dialog-heading { display: flex; align-items: flex-start; gap: 12px; }
.dialog-icon { display: grid; flex: 0 0 auto; width: 40px; height: 40px; place-items: center; border-radius: var(--whisper-radius-md); background: var(--whisper-hover); color: var(--whisper-ink-soft); }
.dialog-title { margin: 0; color: var(--whisper-ink); font-family: 'STKaiti', serif; font-size: 20px; font-weight: 600; }
.dialog-description { margin: 5px 0 0; color: var(--whisper-ink-faint); font-size: 12.5px; line-height: 1.6; }
.password-fields { display: grid; gap: 8px; margin-top: 22px; }
.field-label { margin-top: 5px; color: var(--whisper-ink-soft); font-size: 12px; font-weight: 600; }
.password-input { width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid var(--whisper-line-strong); border-radius: var(--whisper-radius-sm); outline: none; background: var(--whisper-hover); color: var(--whisper-ink); font: inherit; font-size: 13.5px; transition: border-color var(--whisper-duration) var(--whisper-ease), box-shadow var(--whisper-duration) var(--whisper-ease), background var(--whisper-duration) var(--whisper-ease); }
.password-input::placeholder { color: var(--whisper-ink-faint); }
.password-input:focus { border-color: var(--whisper-blue); background: var(--whisper-surface); box-shadow: 0 0 0 3px color-mix(in srgb, var(--whisper-blue) 14%, transparent); }
.password-input:disabled { cursor: not-allowed; opacity: 0.65; }
.form-error { margin: 12px 0 0; color: var(--whisper-danger); font-size: 12.5px; line-height: 1.5; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.dialog-button { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 7px; padding: 0 16px; border: 1px solid var(--whisper-line-strong); border-radius: 999px; background: var(--whisper-surface); color: var(--whisper-ink-soft); font-size: 13.5px; cursor: pointer; transition: transform 120ms var(--whisper-ease), background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease), opacity var(--whisper-duration) var(--whisper-ease); }
.dialog-button:hover:not(:disabled) { background: var(--whisper-hover); color: var(--whisper-ink); }
.dialog-button:active:not(:disabled) { transform: scale(0.97); }
.dialog-button.primary { border-color: transparent; background: linear-gradient(135deg, var(--whisper-blue), var(--whisper-violet)); color: #fff; }
.dialog-button:disabled { cursor: not-allowed; opacity: 0.5; }
.loading-icon { animation: spin 900ms linear infinite; }
.password-dialog-enter-active, .password-dialog-leave-active { transition: opacity 200ms var(--whisper-ease); }
.password-dialog-enter-active .dialog-card, .password-dialog-leave-active .dialog-card { transition: transform 200ms var(--whisper-ease), opacity 200ms var(--whisper-ease); }
.password-dialog-enter-from, .password-dialog-leave-to { opacity: 0; }
.password-dialog-enter-from .dialog-card, .password-dialog-leave-to .dialog-card { opacity: 0; transform: translateY(8px) scale(0.98); }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .password-dialog-enter-active, .password-dialog-leave-active, .password-dialog-enter-active .dialog-card, .password-dialog-leave-active .dialog-card, .loading-icon { animation: none; transition: none; } }
</style>
