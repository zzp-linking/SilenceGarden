<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ImagePicker from './ImagePicker.vue'
import AppIcon from './AppIcon.vue'
import type { PreparedImage } from '@/utils/image'
import { isActiveRunState } from '@/types/ai'
import type { RunState } from '@/types/ai'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  runState?: RunState
  maxLength?: number
  image?: PreparedImage
}>(), { maxLength: 12000 })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [image?: PreparedImage]
  stop: []
  'image-prepared': [image: PreparedImage]
  'image-removed': []
  'image-rejected': [message: string]
}>()

const textarea = ref<HTMLTextAreaElement | null>(null)
const picker = ref<InstanceType<typeof ImagePicker> | null>(null)
const plusButton = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const composing = ref(false)
const menuOpen = ref(false)
const active = computed(() => props.runState ? isActiveRunState(props.runState) : false)
const stopping = computed(() => props.runState === 'stopping')

/** 接近上限时才展示字数，减少常驻噪音。 */
const showCount = computed(() => props.modelValue.length > props.maxLength * 0.8)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !composing.value) {
    event.preventDefault()
    submit()
  }
}
function submit(): void {
  if (!props.disabled && !active.value && props.modelValue.trim()) emit('submit', props.image)
}
async function update(value: string): Promise<void> {
  emit('update:modelValue', value.slice(0, props.maxLength))
  await nextTick()
  if (textarea.value) {
    textarea.value.style.height = 'auto'
    textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 200)}px`
  }
}

/** 整张卡片都是输入区：点击任意空白处聚焦（Gemini/DeepSeek 同款）。 */
function focusTextarea(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('button, a, input, img')) return
  textarea.value?.focus()
}

/** 「+」附件菜单（Gemini 同款展开模式）。 */
function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}
function chooseImage(): void {
  menuOpen.value = false
  picker.value?.open()
}
function onGlobalPointer(event: PointerEvent): void {
  if (!menuOpen.value) return
  const target = event.target as Node
  if (menu.value?.contains(target) || plusButton.value?.contains(target)) return
  menuOpen.value = false
}
function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    plusButton.value?.focus()
  }
}

onMounted(() => {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches) textarea.value?.focus()
  window.addEventListener('pointerdown', onGlobalPointer)
  window.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onGlobalPointer)
  window.removeEventListener('keydown', onGlobalKeydown)
})
watch(active, async (isActive, wasActive) => {
  if (isActive) menuOpen.value = false
  if (wasActive && !isActive) {
    await nextTick()
    textarea.value?.focus()
  }
})
</script>

<template>
  <section class="composer-zone" aria-label="发送消息">
    <div class="composer" :class="{ disabled }" @click="focusTextarea">
      <div v-if="image" class="image-chip">
        <img :src="image.previewUrl" alt="待发送图片预览" />
        <span class="chip-note">仅本轮使用</span>
        <button type="button" class="chip-remove" aria-label="移除图片" title="移除图片" @click="emit('image-removed')">
          <AppIcon name="x" :size="13" />
        </button>
      </div>
      <textarea
        ref="textarea"
        id="whisper-composer"
        name="message"
        :value="modelValue"
        :disabled="disabled"
        rows="1"
        :maxlength="maxLength"
        placeholder="把一个念头放在这里……"
        aria-label="消息内容"
        @input="update(($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      ></textarea>
      <div class="composer-bar">
        <div class="attach">
          <button
            ref="plusButton"
            type="button"
            class="plus-button"
            :class="{ open: menuOpen }"
            :disabled="disabled || active"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            aria-label="添加附件"
            title="添加附件"
            @click="toggleMenu"
          >
            <AppIcon name="plus" :size="18" />
          </button>
          <Transition name="menu">
            <div v-if="menuOpen" ref="menu" class="attach-menu" role="menu" aria-label="附件选项">
              <button type="button" class="menu-item" role="menuitem" @click="chooseImage">
                <span class="item-icon" aria-hidden="true"><AppIcon name="image" :size="16" /></span>
                <span class="item-text">
                  <span class="item-label">上传图片</span>
                  <span class="item-caption">仅本轮对话生效，不会保存</span>
                </span>
              </button>
            </div>
          </Transition>
          <ImagePicker ref="picker" @prepared="emit('image-prepared', $event)" @reject="emit('image-rejected', $event)" />
        </div>
        <span class="bar-spacer"></span>
        <span v-if="showCount" class="char-count">{{ modelValue.length }} / {{ maxLength }}</span>
        <button v-if="active" type="button" class="stop-button" :disabled="stopping" :aria-label="stopping ? '正在停止' : '停止生成'" :title="stopping ? '正在停止' : '停止生成'" @click="emit('stop')">
          <AppIcon :name="stopping ? 'loader-circle' : 'square'" :size="13" :class="{ spinning: stopping }" />
        </button>
        <button
          v-else
          type="button"
          class="send-button"
          :disabled="disabled || !modelValue.trim()"
          aria-label="发送"
          title="发送"
          @click="submit"
        >
          <AppIcon name="arrow-up" :size="17" />
        </button>
      </div>
    </div>
    <p class="privacy">请勿提交敏感信息。消息和一次性图片将交由 DeepSeek 处理；登录后文字对话会保存，图片不会保存。</p>
  </section>
</template>

<style scoped>
.composer-zone {
  width: min(880px, 100%);
}
.composer {
  padding: 8px 12px 8px 14px;
  border: 1px solid var(--whisper-line-strong);
  border-radius: 24px;
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-card);
  cursor: text;
  transition: border-color var(--whisper-duration) var(--whisper-ease), box-shadow var(--whisper-duration) var(--whisper-ease);
}
.composer:focus-within {
  border-color: var(--whisper-violet);
  box-shadow: 0 0 0 3px rgba(128, 104, 216, 0.16), var(--whisper-shadow-card);
}
.composer.disabled {
  opacity: 0.62;
  cursor: not-allowed;
}
.composer textarea {
  display: block;
  width: 100%;
  min-height: 28px;
  max-height: 200px;
  padding: 7px 4px 2px;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--whisper-ink);
  font-family: inherit;
  font-size: 15.5px;
  line-height: 1.65;
}
.composer textarea::placeholder {
  color: var(--whisper-ink-faint);
}

.composer-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

/* 「+」附件菜单 */
.attach {
  position: relative;
  display: flex;
}
.plus-button {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-soft);
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease);
}
.plus-button .app-icon {
  transition: transform 180ms var(--whisper-ease);
}
.plus-button:hover:not(:disabled) {
  background: var(--whisper-hover);
  color: var(--whisper-blue-deep);
}
.plus-button.open {
  background: var(--whisper-active);
  color: var(--whisper-blue-deep);
}
.plus-button.open .app-icon {
  transform: rotate(45deg);
}
.plus-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.attach-menu {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + 10px);
  left: 0;
  min-width: 218px;
  padding: 6px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-lg);
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-menu);
  transform-origin: bottom left;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--whisper-radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease);
}
.menu-item:hover {
  background: var(--whisper-mist);
}
.item-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--whisper-radius-sm);
  background: var(--whisper-mist);
  color: var(--whisper-blue-deep);
}
.item-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}
.item-label {
  color: var(--whisper-ink);
  font-size: 13.5px;
}
.item-caption {
  color: var(--whisper-ink-faint);
  font-size: 11px;
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 150ms var(--whisper-ease), transform 150ms var(--whisper-ease);
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}

.bar-spacer {
  flex: 1;
}
.char-count {
  color: var(--whisper-ink-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.send-button,
.stop-button {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 160ms var(--whisper-ease), filter 160ms var(--whisper-ease), background 160ms var(--whisper-ease);
}
.send-button {
  border: 0;
  background: linear-gradient(135deg, var(--whisper-blue), var(--whisper-violet));
  color: #fff;
}
.send-button:hover:not(:disabled) {
  filter: brightness(1.07);
  transform: scale(1.06);
}
.send-button:disabled {
  background: var(--whisper-mist-deep);
  color: var(--whisper-ink-faint);
  cursor: not-allowed;
}
.stop-button {
  border: 1px solid var(--whisper-line-strong);
  background: var(--whisper-surface);
  color: var(--whisper-ink);
}
.stop-button:hover {
  background: var(--whisper-mist);
}
.stop-button:disabled {
  cursor: wait;
  opacity: 0.6;
}
.spinning {
  animation: composer-spin 900ms linear infinite;
}
@keyframes composer-spin {
  to { transform: rotate(360deg); }
}

.image-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: 100%;
  margin: 4px 0 6px;
  padding: 5px 8px 5px 5px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: var(--whisper-mist);
}
.image-chip img {
  width: 38px;
  height: 38px;
  border-radius: var(--whisper-radius-sm);
  object-fit: cover;
}
.chip-note {
  color: var(--whisper-ink-soft);
  font-size: 11.5px;
  white-space: nowrap;
}
.chip-remove {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-soft);
  cursor: pointer;
}
.chip-remove:hover {
  background: rgba(180, 35, 24, 0.1);
  color: var(--whisper-danger);
}

.privacy {
  margin: 8px 8px 0;
  color: var(--whisper-ink-faint);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .composer,
  .send-button,
  .stop-button,
  .plus-button,
  .plus-button .app-icon,
  .menu-enter-active,
  .menu-leave-active {
    transition: none;
  }
}
</style>
