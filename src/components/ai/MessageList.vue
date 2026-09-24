<script setup lang="ts">
/**
 * 消息列：每轮先用户气泡再当前选中的助手版本。
 * 贴近底部时跟随流式增高；用户上翻超过 120px 出现「回到最新」。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AssistantMessage from './AssistantMessage.vue'
import UserMessage from './UserMessage.vue'
import AppIcon from './AppIcon.vue'
import type { ClientRunState, Conversation, MessageId, TurnViewModel, UserMessage as UserMessageType } from '@/features/ai/model'

const props = defineProps<{ conversation?: Conversation; runs: Record<string, ClientRunState> }>()
const emit = defineEmits<{
  edit: [message: UserMessageType]
  regenerate: [turnId: string]
  continue: [turnId: string]
  stop: [runId: string]
  reconnect: [runId: string]
  'select-version': [turnId: string, messageId: MessageId]
  copy: [text: string]
}>()

const scroller = ref<HTMLElement | null>(null)
const atBottom = ref(true)

const visibleTurns = computed(() => props.conversation?.turns ?? [])

/** runId → 流式状态索引，避免模板里反复 find。 */
const runsByMessage = computed(() => {
  const map = new Map<MessageId, ClientRunState>()
  for (const run of Object.values(props.runs)) map.set(run.assistantMessageId, run)
  return map
})
const runFingerprint = computed(() => Object.values(props.runs).map(run => `${run.runId}:${run.lastSeq}`).join('|'))

/** 距底部不足 120px 视为「在底部」，流式增量才自动跟随。 */
function checkBottom(): void {
  const node = scroller.value
  if (node) atBottom.value = node.scrollHeight - node.scrollTop - node.clientHeight < 120
}
function scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
  void nextTick(() => {
    const node = scroller.value
    if (node && typeof node.scrollTo === 'function') node.scrollTo({ top: node.scrollHeight, behavior })
  })
}
function backToLatest(): void {
  atBottom.value = true
  const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scrollToBottom(reduceMotion ? 'auto' : 'smooth')
}

/** 版本切换：子组件只上报方向，这里解析目标版本 id。 */
function onSelectVersion(turn: TurnViewModel, direction: 'prev' | 'next'): void {
  const versions = turn.assistant_versions
  const currentIndex = Math.max(0, versions.findIndex(version => version.id === turn.selected_assistant_id))
  const target = versions[currentIndex + (direction === 'next' ? 1 : -1)]
  if (target) emit('select-version', turn.id, target.id)
}

// 生成增量时只在贴近底部时跟随
watch([() => visibleTurns.value.length, runFingerprint], () => {
  if (atBottom.value) scrollToBottom()
})
// 切换对话总是回到最新
watch(() => props.conversation?.id, () => {
  atBottom.value = true
  scrollToBottom()
})

onMounted(() => scroller.value?.addEventListener('scroll', checkBottom, { passive: true }))
onBeforeUnmount(() => scroller.value?.removeEventListener('scroll', checkBottom))
</script>

<template>
  <div ref="scroller" class="message-list whisper-scroll">
    <div class="message-column">
      <div v-if="!conversation" class="message-empty">从一束未成形的念头开始。</div>
      <template v-else>
        <section v-for="turn in visibleTurns" :key="turn.id" class="turn">
          <UserMessage :message="turn.user" @edit="emit('edit', $event)" />
          <div
            v-for="(version, index) in turn.assistant_versions"
            v-show="version.id === turn.selected_assistant_id"
            :key="version.id"
          >
            <AssistantMessage
              :version="version"
              :run="runsByMessage.get(version.id)"
              :version-index="index"
              :version-count="turn.assistant_versions.length"
              @continue="emit('continue', turn.id)"
              @regenerate="emit('regenerate', turn.id)"
              @stop="emit('stop', conversation?.active_run_id ?? '')"
              @reconnect="emit('reconnect', conversation?.active_run_id ?? '')"
              @select-version="onSelectVersion(turn, $event)"
              @copy="emit('copy', $event)"
            />
          </div>
        </section>
      </template>
    </div>
    <button v-if="!atBottom" type="button" class="latest-button" @click="backToLatest">
      <AppIcon name="arrow-down" :size="14" /><span>回到最新</span>
    </button>
  </div>
</template>

<style scoped>
.message-list {
  position: relative;
  flex: 1;
  width: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.message-column {
  width: min(840px, 100%);
  margin: 0 auto;
  padding: 24px 20px 96px;
}
.message-empty {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--whisper-ink-faint);
  font-size: 14px;
}
.turn + .turn {
  margin-top: 28px;
}
.latest-button {
  position: sticky;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  min-height: 38px;
  margin: 0 auto;
  padding: 0 16px;
  border: 1px solid var(--whisper-line-strong);
  border-radius: 999px;
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-menu);
  color: var(--whisper-blue-deep);
  font-size: 12.5px;
  cursor: pointer;
  transition: transform var(--whisper-duration) var(--whisper-ease), box-shadow var(--whisper-duration) var(--whisper-ease);
}
.latest-button:hover {
  transform: translateY(-1px);
}
@media (prefers-reduced-motion: reduce) {
  .latest-button {
    transition: none;
  }
}
</style>
