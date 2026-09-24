<script setup lang="ts">
/**
 * 助手气泡：思考面板、Markdown 正文、Run 状态行、复制 / 重新生成 / 版本切换。
 * 多版本用 v-show 保活，避免切换时丢掉已渲染的 Markdown。
 */
import { computed, ref } from 'vue'
import MarkdownContent from './MarkdownContent.vue'
import ReasoningPanel from './ReasoningPanel.vue'
import RunIndicator from './RunIndicator.vue'
import WhisperRipple from './WhisperRipple.vue'
import AppIcon from './AppIcon.vue'
import { isActiveRunState } from '@/features/ai/model'
import type { AssistantVersion, ClientRunState, ConversationId, MessageId, TurnId } from '@/features/ai/model'

const props = defineProps<{
  version: AssistantVersion
  /** 该版本对应的流式状态；终态或历史版本可为 undefined。 */
  run?: ClientRunState
  versionIndex?: number
  versionCount?: number
  conversationId?: ConversationId
  turnId?: TurnId
}>()
const emit = defineEmits<{
  regenerate: []
  continue: []
  stop: []
  'select-version': [direction: 'prev' | 'next']
  copy: [text: string]
  reconnect: []
}>()

const expanded = ref(false)

const isStreaming = computed(() => Boolean(props.run && isActiveRunState(props.run.state)))
const isLive = computed(() => Boolean(props.run && isActiveRunState(props.run.state)))
/** 无在飞 Run 且因长度上限结束时，展示「继续回答」。 */
const canContinue = computed(() => !props.run && props.version.finish_reason === 'max_output_tokens')
const hasVersions = computed(() => (props.versionCount ?? 0) > 1)
const isFirstVersion = computed(() => (props.versionIndex ?? 0) <= 0)
const isLastVersion = computed(() => (props.versionIndex ?? 0) >= (props.versionCount ?? 1) - 1)
</script>

<template>
  <article class="assistant-message" :class="{ live: isLive }">
    <div class="assistant-label">
      <span class="assistant-seal">语</span>
      <span class="assistant-name">静语</span>
      <!-- <WhisperRipple v-if="isLive" :size="17" class="label-ripple" /> -->
    </div>

    <ReasoningPanel v-if="version.reasoning || run" v-model:expanded="expanded" :reasoning="version.reasoning" :state="run?.state" @copy-code="emit('copy', $event)" />

    <MarkdownContent v-if="version.content" :source="version.content" @copy-code="emit('copy', $event)" />

    <p v-if="version.status === 'stopped'" class="terminal-note" role="status">已停止生成，当前内容已保留。</p>
    <p v-else-if="canContinue" class="terminal-note" role="status">本轮已达到长度上限，已生成的内容均已保留。</p>
    <p v-else-if="!version.content && !run && version.status === 'failed'" class="terminal-note" role="status">这次回答未能完成，可以重新生成。</p>
    <p v-else-if="!version.content && !run && version.status === 'partial'" class="terminal-note" role="status">这次回答已中断，可以重新生成。</p>

    <RunIndicator :run="run" @cancel="emit('stop')" @reconnect="emit('reconnect')" />

    <div class="message-actions">
      <button type="button" class="action-button" aria-label="复制回答" title="复制" :disabled="!version.content" @click="emit('copy', version.content)">
        <AppIcon name="copy" :size="15" />
      </button>
      <button type="button" class="action-button" aria-label="重新生成" title="重新生成" :disabled="isStreaming" @click="emit('regenerate')">
        <AppIcon name="refresh-cw" :size="15" />
      </button>
      <button v-if="canContinue" type="button" class="continue-button" @click="emit('continue')">继续回答</button>
      <span v-if="hasVersions" class="version-nav" aria-label="回答版本切换">
        <button type="button" class="action-button" aria-label="上一个版本" title="上一个版本" :disabled="isFirstVersion" @click="emit('select-version', 'prev')">
          <AppIcon name="chevron-left" :size="15" />
        </button>
        <span class="version-label">{{ (versionIndex ?? 0) + 1 }} / {{ versionCount }}</span>
        <button type="button" class="action-button" aria-label="下一个版本" title="下一个版本" :disabled="isLastVersion" @click="emit('select-version', 'next')">
          <AppIcon name="chevron-right" :size="15" />
        </button>
      </span>
    </div>
  </article>
</template>

<style scoped>
.assistant-message {
  padding: 4px 0 6px;
  color: var(--whisper-ink);
}
.assistant-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--whisper-ink-soft);
  font-size: 13px;
}
.assistant-seal {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid var(--whisper-seal);
  border-radius: 7px;
  color: var(--whisper-seal);
  font-family: 'STKaiti', serif;
  font-size: 15px;
  transform: rotate(-4deg);
}
.assistant-name {
  font-family: 'STKaiti', serif;
  font-size: 15px;
  letter-spacing: 0.05em;
}
.label-ripple {
  margin-left: 2px;
}

.terminal-note {
  margin: 10px 0 0;
  color: var(--whisper-seal);
  font-size: 13px;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  opacity: 0;
  transition: opacity var(--whisper-duration) var(--whisper-ease);
}
.assistant-message:hover .message-actions,
.assistant-message:focus-within .message-actions,
.assistant-message.live .message-actions {
  opacity: 1;
}
@media (hover: none) {
  .message-actions {
    opacity: 1;
  }
}
.action-button {
  display: grid;
  min-width: 34px;
  min-height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-faint);
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease);
}
.action-button:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.action-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.continue-button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--whisper-line-strong);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-blue-deep);
  font-size: 12.5px;
  cursor: pointer;
}
.continue-button:hover {
  border-color: var(--whisper-blue);
  background: var(--whisper-hover);
}
.version-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.version-label {
  min-width: 42px;
  color: var(--whisper-ink-faint);
  font-size: 11.5px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .message-actions,
  .action-button {
    transition: none;
  }
}
</style>
