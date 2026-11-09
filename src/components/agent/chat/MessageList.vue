<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import MarkdownContent from '@/components/ai/MarkdownContent.vue'
import type { AgentMessage } from '@/features/agent/chat/model'

/** 阅读行为归消息面板管理，独立于传输和当前选中会话。 */
const props = defineProps<{ messages: AgentMessage[]; chatId: string; hasMore?: boolean; loading?: boolean }>()
const emit = defineEmits<{ older: [] }>() // 上层负责读取，本组件维护滚动锚点。
let anchor: { height: number; top: number; chat: string } | undefined // 加载前的阅读位置。
/** 更早页插入后按新增高度维持当前阅读锚点。 */
function older(): void { const p = pane.value; if (p) { anchor = { height: p.scrollHeight, top: p.scrollTop, chat: props.chatId }; pinned.value = false }; emit('older') }
const pane = useTemplateRef<HTMLElement>('pane') // 消息滚动容器。
const pinned = shallowRef(true) // 尊重用户向上阅读，只有明确回到底部后才继续自动跟随。
const size = computed(() => props.messages.reduce((n, m) => n + m.text.length + m.reasoning.length, 0))
const labels: Record<string, string> = { running: '生成中', stopping: '正在停止', stopped: '已停止 · 未完成', failed: '生成失败 · 未完成', incomplete: '回答未完成', completed: '已完成', interrupted: '服务重启 · 已中断' }
/** 记录用户滚动意图，不移动键盘焦点。 */
function scroll(): void { const p = pane.value; if (p) pinned.value = p.scrollHeight - p.scrollTop - p.clientHeight < 80 }
/** 明确恢复底部跟随。 */
function bottom(): void { pinned.value = true; const p = pane.value; if (p) p.scrollTop = p.scrollHeight }
watch(() => props.chatId, () => { pinned.value = true; void nextTick(bottom) })
watch(size, () => { if (pinned.value) void nextTick(bottom) })
watch(() => props.loading, async value => { if (!value && anchor) { await nextTick(); const p = pane.value; if (p && anchor?.chat === props.chatId) p.scrollTop = anchor.top + p.scrollHeight - anchor.height; anchor = undefined } })
</script>

<template>
  <div class="message-frame">
    <div ref="pane" class="message-pane" tabindex="0" aria-label="会话消息" @scroll="scroll">
      <a-button v-if="hasMore" block :loading="loading" @click="older">加载更早消息</a-button>
      <a-empty v-if="!messages.length" description="从一个问题开始。这个会话拥有独立上下文。" />
      <article v-for="message in messages" :key="message.message_id" class="agent-message" :class="message.role">
        <div class="message-author">{{ message.role === 'user' ? '你' : '智能助手' }}</div>
        <details v-if="message.reasoning" class="reasoning"><summary>思考过程</summary><pre>{{ message.reasoning }}</pre></details>
        <p v-if="message.role === 'user'" class="user-text">{{ message.text }}</p>
        <!-- 复用既有渲染器，禁用原始 HTML 并净化 Markdown 和代码输出。 -->
        <MarkdownContent v-else :source="message.text" :max-chars="524288" />
        <p v-if="message.role === 'assistant'" class="message-state">{{ labels[message.status] }}<span v-if="message.reason && message.status !== 'completed'"> · {{ message.reason }}</span></p>
        <p v-else-if="message.status === 'interrupted'" class="message-state">服务重启，本轮未提交的输出不可恢复。</p>
      </article>
    </div>
    <a-button v-if="!pinned" class="back-bottom" @click="bottom">回到底部</a-button>
  </div>
</template>

<style scoped>
.message-frame { min-height: 0; position: relative; flex: 1; }
.message-pane { overflow: auto; height: 100%; padding: 24px max(20px, calc((100% - 800px) / 2)); overscroll-behavior: contain; }
.agent-message { margin-bottom: 28px; padding: 20px; border: 1px solid var(--agent-border); border-radius: 10px; background: var(--agent-surface); overflow-wrap: anywhere; }
.agent-message.user { background: var(--agent-selected); border-color: transparent; }
.message-author { font-weight: 600; margin-bottom: 12px; }
.user-text { white-space: pre-wrap; margin: 0; line-height: 1.8; }
.reasoning { margin-bottom: 12px; color: var(--agent-muted); }
.reasoning summary { cursor: pointer; padding: 4px 0; }
.reasoning pre { white-space: pre-wrap; font: inherit; line-height: 1.8; padding: 12px; background: var(--agent-canvas); max-height: 360px; overflow: auto; }
.message-state { margin: 12px 0 0; font-size: 12px; color: var(--agent-muted); }
.back-bottom { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); }
</style>
