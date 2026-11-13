<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import MarkdownContent from '@/components/ai/MarkdownContent.vue'
import MessageResources from './MessageResources.vue'
import RunPlan from './RunPlan.vue'
import { terminal, type AgentMessage } from '@/features/agent/chat/model'

/** 阅读行为归消息面板管理，独立于传输和当前选中会话。 */
const props = defineProps<{
  messages: AgentMessage[] // 当前会话的有序可见消息。
  chatId: string // 用于隔离会话的滚动位置。
  hasMore?: boolean // 是否还有历史页。
  loading?: boolean // 是否正在读取历史页。
  activeReply?: {
    messageId: string // 当前运行绑定的助手消息标识。
    label: string // 由当前活动、连接或保存状态生成的提示。
    toolNotice?: string // 服务端提供的工具可用性说明。
    reconnectable: boolean // 是否提供手动重连入口。
    updating: boolean // 是否显示活动动画，等待用户操作时静止。
  }
}>()
const emit = defineEmits<{
  older: [] // 上层负责读取，本组件维护滚动锚点。
  reconnect: [runId: string] // 由上层恢复指定回复的运行订阅。
}>()
let anchor: { height: number; top: number; chat: string } | undefined // 加载前的阅读位置。
/** 更早页插入后按新增高度维持当前阅读锚点。 */
function older(): void { const p = pane.value; if (p) { anchor = { height: p.scrollHeight, top: p.scrollTop, chat: props.chatId }; pinned.value = false }; emit('older') }
const pane = useTemplateRef<HTMLElement>('pane') // 消息滚动容器。
const pinned = shallowRef(true) // 尊重用户向上阅读，只有明确回到底部后才继续自动跟随。
const size = computed(() => props.messages.reduce((n, m) => n + m.text.length + m.reasoning.length, 0)) // 用累计长度追踪流式正文和思考内容。
const activePlanVersion = computed(() => props.messages.find(message => message.message_id === props.activeReply?.messageId)?.plan?.plan_version) // 计划可能早于正文出现，也需要跟随滚动。
const labels: Record<string, string> = { running: '生成中', stopping: '正在停止', stopped: '已停止 · 未完成', failed: '生成失败 · 未完成', incomplete: '回答未完成', completed: '已完成', interrupted: '服务重启 · 已中断' }
/** 记录用户滚动意图，不移动键盘焦点。 */
function scroll(): void { const p = pane.value; if (p) pinned.value = p.scrollHeight - p.scrollTop - p.clientHeight < 80 }
/** 明确恢复底部跟随。 */
function bottom(): void { pinned.value = true; const p = pane.value; if (p) p.scrollTop = p.scrollHeight }
watch(() => props.chatId, () => { pinned.value = true; void nextTick(bottom) })
// DOM 更新后跟随新增的回复、状态和计划，向上翻阅时保持阅读位置。
onMounted(bottom)
watch([size, () => props.messages.length, () => props.activeReply, activePlanVersion], () => {
  if (pinned.value) bottom()
}, { flush: 'post' })
watch(() => props.loading, async value => { if (!value && anchor) { await nextTick(); const p = pane.value; if (p && anchor?.chat === props.chatId) p.scrollTop = anchor.top + p.scrollHeight - anchor.height; anchor = undefined } })
</script>

<template>
  <div class="message-frame">
    <div ref="pane" class="message-pane" tabindex="0" aria-label="会话消息" @scroll="scroll">
      <a-button v-if="hasMore" block :loading="loading" @click="older">加载更早消息</a-button>
      <a-empty v-if="!messages.length" description="从一个问题开始。这个会话拥有独立上下文。" />
      <article v-for="message in messages" :key="message.message_id" class="agent-message" :class="message.role">
        <div class="message-author">{{ message.role === 'user' ? '你' : '智能助手' }}</div>
        <div v-if="message.role === 'assistant' && activeReply && message.message_id === activeReply.messageId" class="reply-progress">
          <div role="status" aria-atomic="true">
            <span class="reply-progress-label">
              <span v-if="activeReply.updating" class="reply-progress-dot" aria-hidden="true"></span>
              {{ activeReply.label }}
            </span>
            <span v-if="activeReply.toolNotice" class="reply-tool-notice">{{ activeReply.toolNotice }}</span>
          </div>
          <a-button v-if="activeReply.reconnectable" size="small" @click="emit('reconnect', message.run_id)">重新连接</a-button>
        </div>
        <!-- 计划随同一条回复更新，生成结束后仍保留已展开的详情。 -->
        <RunPlan v-if="message.plan" :plan="message.plan" />
        <details v-if="message.reasoning" class="reasoning"><summary>思考过程</summary><pre>{{ message.reasoning }}</pre></details>
        <p v-if="message.role === 'user'" class="user-text">{{ message.text }}</p>
        <!-- 复用既有渲染器，禁用原始 HTML 并净化 Markdown 和代码输出。 -->
        <MarkdownContent v-else :source="message.text" :max-chars="524288" />
        <MessageResources v-if="message.sources?.length || message.artifacts?.length"
          :sources="message.sources" :artifacts="message.artifacts" />
        <p v-if="message.role === 'assistant' && (message.message_id !== activeReply?.messageId || terminal(message.status))" class="message-state">{{ labels[message.status] }}<span v-if="message.reason && message.status !== 'completed'"> · {{ message.reason }}</span></p>
        <p v-else-if="message.role === 'user' && message.status === 'interrupted'" class="message-state">服务重启，本轮未提交的输出不可恢复。</p>
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
/* 活动提示沿用消息卡片的次要文字色，动画只用于正在推进的状态。 */
.reply-progress { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 8px; font-size: 13px; color: var(--agent-muted); }
.reply-progress-label { display: flex; align-items: flex-start; gap: 8px; line-height: 20px; }
.reply-progress-dot { flex: 0 0 6px; height: 6px; margin-top: 7px; border-radius: 50%; background: var(--agent-primary); animation: reply-progress-pulse 1.6s ease-in-out infinite alternate; }
.reply-tool-notice { display: block; margin-top: 4px; }
@keyframes reply-progress-pulse { from { opacity: .5; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .reply-progress-dot { animation: none; } }
.user-text { white-space: pre-wrap; margin: 0; line-height: 1.8; }
.reasoning { margin-bottom: 12px; color: var(--agent-muted); }
.reasoning summary { cursor: pointer; padding: 4px 0; }
.reasoning pre { white-space: pre-wrap; font: inherit; line-height: 1.8; padding: 12px; background: var(--agent-canvas); max-height: 360px; overflow: auto; }
.message-state { margin: 12px 0 0; font-size: 12px; color: var(--agent-muted); }
.back-bottom { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); }
</style>
