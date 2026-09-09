<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { aiApi } from '@/api/chat'
import ChatSidebar from '@/components/ai/ChatSidebar.vue'
import EmptyPrompts from '@/components/ai/EmptyPrompts.vue'
import MessageList from '@/components/ai/MessageList.vue'
import ChatComposer from '@/components/ai/ChatComposer.vue'
import ConfirmDialog from '@/components/ai/ConfirmDialog.vue'
import ToastHost from '@/components/ai/ToastHost.vue'
import AppIcon from '@/components/ai/AppIcon.vue'
import { useToast } from '@/composables/useToast'
import type { AcceptedRunRecord, Conversation, ConversationId, RunOperation, RunRecord, UserMessage } from '@/types/ai'
import { isTerminalRunState, toConversationId, toPublicId, toRunId, toTurnId, toMessageId } from '@/types/ai'
import type { PreparedImage } from '@/utils/image'
import { createUuidV7 } from '@/utils/uuidV7'
import { runTransportManager } from '@/transport'
import { useUserStore } from '@/store/user'
import { useAiBootstrapStore } from '@/stores/aiBootstrap'
import { useChatRunsStore } from '@/stores/chatRuns'
import { useConversationsStore } from '@/stores/conversations'

const route = useRoute(); const router = useRouter(); const userStore = useUserStore(); const bootstrapStore = useAiBootstrapStore(); const runsStore = useChatRunsStore(); const conversationsStore = useConversationsStore()
const { data: bootstrap, loading: bootstrapLoading, prompts } = storeToRefs(bootstrapStore)
const { items, current, ephemeral, currentId } = storeToRefs(conversationsStore)
const { byId: runs } = storeToRefs(runsStore)
const toast = useToast()
const draft = ref(''); const image = ref<PreparedImage>(); const importOpen = ref(false); const pendingDelete = ref<ConversationId | null>(null)
const editingMessage = ref<UserMessage>()
const syncedRegenerations = new Set<string>()
const isAnonymous = computed(() => !userStore.isAuthenticated)
const activeRun = computed(() => {
  const referenced = current.value?.active_run_id ? runs.value[current.value.active_run_id] : undefined
  if (referenced && !isTerminalRunState(referenced.state)) return referenced
  return Object.values(runs.value).find(run => run.conversationId === currentId.value && !isTerminalRunState(run.state))
})
const serviceDisabled = computed(() => bootstrap.value ? !bootstrap.value.service.enabled : false)
const pendingDeleteTitle = computed(() => pendingDelete.value ? conversationsStore.byId[pendingDelete.value]?.title ?? '' : '')

/* 侧边栏：桌面端可折叠（记忆偏好），窄屏为抽屉 */
const collapsed = ref(typeof localStorage !== 'undefined' && localStorage.getItem('whisper.sidebar.collapsed') === '1')
const drawerOpen = ref(false)
const narrowQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1023px)') : null
const isNarrow = ref(narrowQuery?.matches ?? false)
function onNarrowChange(event: MediaQueryListEvent): void { isNarrow.value = event.matches; if (!event.matches) drawerOpen.value = false }
function onToggle(): void { if (isNarrow.value) drawerOpen.value = !drawerOpen.value; else collapsed.value = !collapsed.value }
function onGlobalKeydown(event: KeyboardEvent): void { if (event.key === 'Escape' && drawerOpen.value) drawerOpen.value = false }
watch(collapsed, value => localStorage.setItem('whisper.sidebar.collapsed', value ? '1' : '0'))

function randomId(): string { return createUuidV7() }
function revokeImage(): void { if (image.value) { URL.revokeObjectURL(image.value.previewUrl); image.value = undefined } }
function makeEphemeralConversation(content: string, identity = randomId()): Conversation { return { id: toConversationId(`ephemeral-${identity}`), title: content.slice(0, 24) || '未命名对话', source: 'ephemeral', updated_at: new Date().toISOString(), turn_ids: [], turns: [] } }
function createAnonymousRun(_content: string, clientRequestId: string, conversationId: ConversationId): AcceptedRunRecord { const id = toRunId(clientRequestId); return { run_id: id, operation: 'send', conversation_id: conversationId, turn_id: toTurnId(randomId()), user_message_id: toMessageId(randomId()), assistant_message_id: toMessageId(randomId()), conversation_revision: 0, state: 'reserved', events_url: '', reservation: { reserved_micro_cny: 0, price_version: 0 } } }
function historyFor(conversation: Conversation): { role: 'user' | 'assistant'; content: string }[] { return conversation.turns.flatMap(turn => { const assistant = turn.assistant_versions.find(version => version.id === turn.selected_assistant_id) ?? turn.assistant_versions[0]; return [{ role: 'user' as const, content: turn.user.content }, ...(assistant?.content ? [{ role: 'assistant' as const, content: assistant.content }] : [])] }).slice(-10) }

async function ensureConversation(content: string, identity: string): Promise<Conversation> { if (current.value) return current.value; if (!isAnonymous.value) return conversationsStore.create(); const conversation = makeEphemeralConversation(content, identity); conversationsStore.addEphemeral(conversation); return conversation }
async function submit(content: string, prepared?: PreparedImage, operation: 'send' | 'regenerate' | 'edit_and_fork' = 'send', source?: UserMessage): Promise<void> {
  if (activeRun.value || serviceDisabled.value) return
  const clientRequestId = toPublicId(randomId()); const conversation = await ensureConversation(content, clientRequestId)
  try {
    if (isAnonymous.value) {
      const run = createAnonymousRun(content, clientRequestId, conversation.id); conversationsStore.attachRun(run, content, Boolean(prepared), operation); runsStore.register(run); runTransportManager.startAnonymous(run, callbacks(run, operation), { client_request_id: clientRequestId, content, history: historyFor(conversation), reasoning_effort: 'low' }, prepared?.blob)
    } else {
      const run = await aiApi.createRun({ client_request_id: clientRequestId, operation, conversation_id: conversation.id, source_message_id: source?.id, content, reasoning_effort: 'low', image: prepared?.blob }); conversationsStore.attachRun(run, content, Boolean(prepared), operation); runsStore.register(run); runTransportManager.startLogin(run, callbacks(run, operation), 0)
    }
    draft.value = ''; revokeImage()
  } catch (error) { toast.error(error instanceof Error ? error.message : '发送失败，请稍后再试') }
}
function submitDraft(prepared?: PreparedImage): Promise<void> { const source = editingMessage.value; editingMessage.value = undefined; return submit(draft.value, prepared, source && !isAnonymous.value ? 'edit_and_fork' : 'send', source) }
function callbacks(run: RunRecord, operation: RunOperation = 'send') { return { onEvent: (event: Parameters<typeof runsStore.ingest>[0]) => { conversationsStore.applyRunEvent(event); runsStore.ingest(event); const state = runsStore.byId[event.run_id]; if (state) conversationsStore.syncRun(state); if (operation === 'regenerate' && !isAnonymous.value && ['run.completed', 'run.stopped'].includes(event.type) && state && !syncedRegenerations.has(event.run_id)) { syncedRegenerations.add(event.run_id); void conversationsStore.selectVersion(state.conversationId, state.turnId, state.assistantMessageId).catch(() => { toast.error('回答已保存，但版本选择同步失败；刷新后可重新选择。') }) } }, onConnection: (connection: Parameters<typeof runsStore.setConnection>[1], attempt: number) => runsStore.setConnection(run.run_id, connection, attempt), onError: (error: Error) => { runsStore.setError(run.run_id, { code: 'TRANSPORT_ERROR', message: error.message, retryable: !isAnonymous.value }) } } }
async function stop(): Promise<void> {
  const run = activeRun.value
  if (!run || run.state === 'stopping') return
  const previous = runsStore.markStopping(run.runId)
  if (!previous) return
  const stopping = runsStore.byId[run.runId]
  if (stopping) conversationsStore.syncRun(stopping)
  if (isAnonymous.value) {
    runTransportManager.stop(run.runId)
    runsStore.markStopped(run.runId)
    const stopped = runsStore.byId[run.runId]
    if (stopped) conversationsStore.syncRun(stopped)
    return
  }
  try {
    // 保持 SSE 打开，由服务端的 run.stopped 统一落终态和释放输入框。
    await aiApi.cancelRun(run.runId)
    const latest = runsStore.byId[run.runId]
    if (latest && !isTerminalRunState(latest.state) && !runTransportManager.has(run.runId)) reconnect(run.runId)
  } catch (error) {
    runsStore.restoreAfterStopFailure(run.runId, previous)
    const restored = runsStore.byId[run.runId]
    if (restored) conversationsStore.syncRun(restored)
    toast.error(error instanceof Error ? error.message : '停止失败，请稍后再试')
  }
}
function choosePrompt(prompt: string): void { draft.value = prompt }
async function selectConversation(id: ConversationId): Promise<void> { try { await conversationsStore.select(id); await router.replace({ query: { conversation: id } }); if (isNarrow.value) drawerOpen.value = false } catch (error) { toast.error(error instanceof Error ? error.message : '会话加载失败，请稍后再试') } }
async function newConversation(): Promise<void> { try { if (!isAnonymous.value) await conversationsStore.create(); else { const conversation = makeEphemeralConversation('未命名对话'); conversationsStore.addEphemeral(conversation) } draft.value = ''; if (isNarrow.value) drawerOpen.value = false } catch (error) { toast.error(error instanceof Error ? error.message : '新建会话失败，请稍后再试') } }
async function rename(id: ConversationId, title: string): Promise<void> { try { await conversationsStore.rename(id, title) } catch { toast.error('重命名失败，原名称已恢复') } }
function requestRemove(id: ConversationId): void { pendingDelete.value = id }
async function confirmRemove(): Promise<void> { const id = pendingDelete.value; pendingDelete.value = null; if (!id) return; try { runTransportManager.stop(conversationsStore.byId[id]?.active_run_id ?? toRunId('')); await conversationsStore.remove(id) } catch { toast.error('删除失败，请稍后再试') } }
function editMessage(message: UserMessage): void { editingMessage.value = message; draft.value = message.content }
async function regenerateTurn(turnId: string): Promise<void> { const turn = current.value?.turns.find(item => item.id === turnId); if (!turn || activeRun.value) return; if (turn.user.had_image) { toast.info('这轮包含图片，重新生成前请重新附图。'); editingMessage.value = turn.user; draft.value = turn.user.content; return } if (isAnonymous.value) { conversationsStore.currentId = null; await submit(turn.user.content) } else await submit(turn.user.content, undefined, 'regenerate', turn.user) }
async function continueTurn(turnId: string): Promise<void> { const turn = current.value?.turns.find(item => item.id === turnId); if (!turn || activeRun.value) return; await submit('请从上一条回答中断的位置继续，不要重复已经完成的内容。') }
async function selectVersion(turnId: string, messageId: Parameters<typeof conversationsStore.selectVersion>[2]): Promise<void> { if (currentId.value) await conversationsStore.selectVersion(currentId.value, turnId, messageId) }
function reconnect(runId: string): void { const run = runs.value[runId]; if (run) { const turn = conversationsStore.byId[run.conversationId]?.turns.find(item => item.id === run.turnId); const record: RunRecord = { run_id: run.runId, operation: run.operation, conversation_id: run.conversationId, turn_id: run.turnId, user_message_id: turn?.user.id ?? run.assistantMessageId, assistant_message_id: run.assistantMessageId, state: run.state, events_url: '', reservation: { reserved_micro_cny: 0, price_version: 0 } }; runTransportManager.startLogin(record, callbacks(record, record.operation), run.lastSeq) } }
function applyImage(value: PreparedImage): void { revokeImage(); image.value = value }
function copy(text: string): void { if (!navigator.clipboard) { toast.info('已选中回答，请使用 Ctrl/Cmd+C 复制'); return } void navigator.clipboard.writeText(text).then(() => { toast.success('已复制') }).catch(() => { toast.error('复制失败，请手动选择文本') }) }
function discardImport(): void { importOpen.value = false; conversationsStore.discardEphemeral() }
async function confirmImport(): Promise<void> { try { await conversationsStore.importEphemeral(); importOpen.value = false } catch { toast.error('导入失败，临时副本仍保留') } }
async function load(): Promise<void> { await bootstrapStore.load().catch(() => undefined); if (userStore.isAuthenticated) { await conversationsStore.load(); const active = await aiApi.activeRuns(); for (const run of active) { await conversationsStore.hydrate(run.conversation_id); conversationsStore.attachRecoveredRun(run); conversationsStore.markRunActive(run); runsStore.register(run); runTransportManager.startLogin(run, callbacks(run, run.operation), 0) } const requested = route.query.conversation; if (typeof requested === 'string' && conversationsStore.byId[requested]) await conversationsStore.select(toConversationId(requested)) } }
watch(() => route.query.conversation, value => { if (typeof value === 'string' && conversationsStore.byId[value]) void conversationsStore.select(toConversationId(value)) }, { immediate: true })
watch(runs, value => { for (const run of Object.values(value)) conversationsStore.syncRun(run) }, { deep: true })
watch(() => userStore.isAuthenticated, authenticated => { if (authenticated && ephemeral.value.length) importOpen.value = true })
onMounted(() => { narrowQuery?.addEventListener('change', onNarrowChange); window.addEventListener('keydown', onGlobalKeydown); void load() })
onBeforeUnmount(() => { narrowQuery?.removeEventListener('change', onNarrowChange); window.removeEventListener('keydown', onGlobalKeydown); runTransportManager.closeAnonymous(); revokeImage() })
</script>

<template>
  <main class="ai-shell">
    <ChatSidebar
      :items="items"
      :current-id="currentId"
      :collapsed="collapsed"
      :floating="isNarrow"
      :open="drawerOpen"
      :loading="conversationsStore.loading"
      :can-search="userStore.isAuthenticated"
      :show-login="!userStore.isAuthenticated"
      @select="selectConversation"
      @create="newConversation"
      @rename="rename"
      @request-delete="requestRemove"
      @search="conversationsStore.load"
      @toggle="onToggle"
    />
    <Transition name="scrim">
      <div v-if="isNarrow && drawerOpen" class="scrim" aria-hidden="true" @click="drawerOpen = false"></div>
    </Transition>

    <section class="chat-main">
      <header class="chat-topbar">
        <div class="topbar-left">
          <button v-if="isNarrow" class="icon-button" type="button" aria-label="打开对话历史" @click="drawerOpen = true">
            <AppIcon name="menu" :size="19" />
          </button>
          <p class="topbar-title">{{ current?.title || '静语' }}</p>
        </div>
        <div class="topbar-right">
          <span v-if="bootstrap" class="quota">{{ bootstrap.identity.kind === 'anonymous' ? `匿名 · 剩余 ${bootstrap.identity.rounds_remaining} 轮` : '已登录' }}</span>
          <router-link v-if="!userStore.isAuthenticated" to="/login" class="topbar-link"><AppIcon name="log-in" :size="14" /><span>登录保存历史</span></router-link>
          <router-link v-else-if="userStore.user?.role === 'admin'" to="/admin" class="topbar-link">管理</router-link>
        </div>
      </header>

      <div v-if="bootstrapLoading" class="state-block">正在铺开静语……</div>
      <div v-else-if="serviceDisabled && !current" class="state-block">
        <h2>静语暂时休息</h2>
        <p>{{ bootstrap?.service.maintenance_message }}</p>
        <p class="state-sub">历史和登录仍然可用。</p>
      </div>
      <EmptyPrompts v-else-if="!current || !current.turns.length" :prompts="prompts" :disabled="Boolean(activeRun)" @choose="choosePrompt" />
      <MessageList
        v-else
        :conversation="current"
        :runs="runs"
        @edit="editMessage"
        @continue="continueTurn"
        @regenerate="regenerateTurn"
        @stop="stop"
        @reconnect="reconnect"
        @select-version="selectVersion"
        @copy="copy"
      />

      <div class="composer-wrap">
        <ChatComposer
          v-model="draft"
          :disabled="serviceDisabled"
          :run-state="activeRun?.state"
          :image="image"
          :max-length="bootstrap?.limits.max_input_chars"
          @submit="submitDraft"
          @stop="stop"
          @image-prepared="applyImage"
          @image-removed="revokeImage"
          @image-rejected="toast.error($event)"
        />
      </div>
    </section>

    <ConfirmDialog
      :open="pendingDelete !== null"
      title="删除这段对话？"
      :message="pendingDeleteTitle ? `「${pendingDeleteTitle}」删除后无法恢复。` : '删除后无法恢复。'"
      confirm-text="删除"
      danger
      @confirm="confirmRemove"
      @cancel="pendingDelete = null"
    />
    <ConfirmDialog
      :open="importOpen"
      title="导入本次对话？"
      :message="`发现 ${ephemeral.length} 段临时对话。只会导入文字，图片无法恢复。`"
      confirm-text="导入本次对话"
      cancel-text="暂不导入"
      @confirm="confirmImport"
      @cancel="discardImport"
    />
    <ToastHost />
  </main>
</template>

<style scoped>
.ai-shell {
  display: flex;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--whisper-canvas);
  color: var(--whisper-ink);
}
.chat-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  background:
    radial-gradient(circle at 78% -8%, rgba(128, 104, 216, 0.09), transparent 42%),
    radial-gradient(circle at 8% 108%, rgba(91, 124, 219, 0.08), transparent 46%),
    var(--whisper-canvas);
}

.chat-topbar {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--whisper-line);
}
.topbar-left,
.topbar-right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}
.topbar-title {
  overflow: hidden;
  margin: 0;
  color: var(--whisper-ink);
  font-family: 'STKaiti', serif;
  font-size: 17px;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon-button {
  display: grid;
  min-width: 40px;
  min-height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-soft);
  cursor: pointer;
}
.icon-button:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.quota {
  padding: 4px 11px;
  border: 1px solid var(--whisper-line);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-ink-faint);
  font-size: 11.5px;
  white-space: nowrap;
}
.topbar-link {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 13px;
  border-radius: 999px;
  color: var(--whisper-blue-deep);
  font-size: 12.5px;
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--whisper-duration) var(--whisper-ease);
}
.topbar-link:hover {
  background: var(--whisper-hover);
}

.state-block {
  margin: auto;
  padding: 24px;
  color: var(--whisper-ink-soft);
  text-align: center;
}
.state-block h2 {
  margin: 0 0 8px;
  color: var(--whisper-ink);
  font-family: 'STKaiti', serif;
  font-size: 26px;
  font-weight: 500;
}
.state-sub {
  color: var(--whisper-ink-faint);
  font-size: 13px;
}

.composer-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 16px 14px;
}

.scrim {
  position: fixed;
  inset: 0;
  z-index: 45;
  background: var(--whisper-overlay);
}
.scrim-enter-active,
.scrim-leave-active {
  transition: opacity 220ms var(--whisper-ease);
}
.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
}

/* 键盘焦点环由 whisper.css 全局提供（:where 零优先级，仅交互控件） */

@media (prefers-reduced-motion: reduce) {
  .topbar-link,
  .scrim-enter-active,
  .scrim-leave-active {
    transition: none;
  }
}
</style>
