<script setup lang="ts">
/**
 * 静语对话页：侧栏历史 + 消息列 + 输入框。
 *
 * 登录：POST /ai/runs 后订阅可重放 SSE。
 * 匿名：POST /ai/anonymous/stream，对话存在 ephemeral-* 占位 ID，首帧 created 后换成服务端 ID。
 * workspaceEpoch 在登出时递增，丢弃进行中的 load/dispatch。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { V2HttpError } from '@/api/clientV2'
import { aiApi } from '@/api/chat'
import ChatSidebar from '@/components/ai/ChatSidebar.vue'
import EmptyPrompts from '@/components/ai/EmptyPrompts.vue'
import MessageList from '@/components/ai/MessageList.vue'
import ChatComposer from '@/components/ai/ChatComposer.vue'
import ConfirmDialog from '@/components/ai/ConfirmDialog.vue'
import ToastHost from '@/components/ai/ToastHost.vue'
import AppIcon from '@/components/ai/AppIcon.vue'
import AccountMenu from '@/components/auth/AccountMenu.vue'
import { useAuthSession } from '@/composables/useAuthSession'
import { useToast } from '@/composables/useToast'
import type { AcceptedRunRecord, ClientRunState, Conversation, ConversationId, RunEvent, RunId, RunOperation, RunRecord, TurnId, TurnViewModel, UserMessage } from '@/features/ai/model'
import { isTerminalRunState, toConversationId, toPublicId, toRunId, toTurnId, toMessageId } from '@/features/ai/model'
import type { PreparedImage } from '@/utils/image'
import { createUuidV7 } from '@/utils/uuidV7'
import { runTransportManager } from '@/features/ai/transport'
import { runEventRenderScheduler } from '@/features/ai/streaming'
import { useUserStore } from '@/stores/user'
import { useAiBootstrapStore } from '@/stores/ai/aiBootstrap'
import { useChatRunsStore } from '@/stores/ai/chatRuns'
import { useConversationsStore } from '@/stores/ai/conversations'

const route = useRoute(); const router = useRouter(); const userStore = useUserStore(); const { isAuthenticated, user } = useAuthSession(); const bootstrapStore = useAiBootstrapStore(); const runsStore = useChatRunsStore(); const conversationsStore = useConversationsStore()
const { data: bootstrap, loading: bootstrapLoading, prompts } = storeToRefs(bootstrapStore)
const { items, current, ephemeral, currentId } = storeToRefs(conversationsStore)
const { byId: runs } = storeToRefs(runsStore)
const toast = useToast()
/** 输入框草稿。发送成功后清空。 */
const draft = ref('')
/** 本轮待发送图片；发送或移除时 revokeObjectURL。 */
const image = ref<PreparedImage>()
/** 登录后发现 ephemeral 时弹出导入确认。 */
const importOpen = ref(false)
const pendingDelete = ref<ConversationId | null>(null)
/** 正在编辑的用户消息；提交时登录走 edit_and_fork，匿名走普通 send。 */
const editingMessage = ref<UserMessage>()
/** 同一 regenerate 终态只同步一次选中版本，避免重复 PATCH。 */
const syncedRegenerations = new Set<string>()
/** 匿名 transport 随页面卸载关闭；登录 channel 则跨页面继续存在。 */
const anonymousRunIds = new Set<RunId>()
const isAnonymous = computed(() => !isAuthenticated.value)
const anonymousQuotaText = computed(() => {
  const identity = bootstrap.value?.identity
  if (!identity || identity.kind !== 'anonymous' || isAuthenticated.value) return ''
  return `匿名 · 剩余 ${identity.rounds_remaining} 轮`
})
/** 工作区代数：登出/清场时 +1，过期的异步回调直接 return。 */
let workspaceEpoch = 0
/** 当前对话正在进行的 Run。优先看 active_run_id，再扫 runs 里同 conversation 的非终态项。 */
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
/** 浏览器本地匿名对话。id 形如 ephemeral-{uuid}，收到服务端 ID 后会被 applyRunEvent 替换。 */
function makeEphemeralConversation(content: string, identity = randomId()): Conversation { return { id: toConversationId(`ephemeral-${identity}`), title: content.slice(0, 24) || '未命名对话', source: 'ephemeral', updated_at: new Date().toISOString(), turn_ids: [], turns: [] } }
/**
 * 匿名流在 createRun 返回前就要占位气泡，因此用 client_request_id 当作本地 run_id。
 * 真正的 turn/message id 等第一帧 run.created。
 */
function createAnonymousRun(clientRequestId: string, conversationId: ConversationId, operation: RunOperation, sourceTurn?: TurnViewModel): AcceptedRunRecord { const id = toRunId(clientRequestId); return { run_id: id, operation, conversation_id: conversationId, turn_id: sourceTurn?.id ?? toTurnId(randomId()), user_message_id: sourceTurn?.user.id ?? toMessageId(randomId()), assistant_message_id: toMessageId(randomId()), conversation_revision: 0, state: 'reserved', events_url: '', reservation: { reserved_micro_cny: 0, price_version: 0 } } }
/** 匿名请求只带最近 10 条已完成正文；regenerate 只取目标 Turn 之前的稳定上下文。 */
function historyFor(conversation: Conversation, beforeTurnId?: TurnId): { role: 'user' | 'assistant'; content: string }[] {
  const boundary = beforeTurnId ? conversation.turns.findIndex(turn => turn.id === beforeTurnId) : conversation.turns.length
  const turns = conversation.turns.slice(0, boundary < 0 ? conversation.turns.length : boundary)
  return turns.flatMap(turn => { const assistant = turn.assistant_versions.find(version => version.id === turn.selected_assistant_id) ?? turn.assistant_versions[0]; return [{ role: 'user' as const, content: turn.user.content }, ...(assistant?.content ? [{ role: 'assistant' as const, content: assistant.content }] : [])] }).slice(-10)
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof V2HttpError && (error.status === 401 || error.apiError.code === 'AUTH_REQUIRED' || error.apiError.code === 'SESSION_EXPIRED')
}
function displayError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
/** 没有当前对话时：登录走服务端 create，匿名建 ephemeral。identity 用于匿名占位 ID。 */
async function ensureConversation(content: string, identity: string): Promise<Conversation> {
  if (current.value) return current.value
  if (!isAnonymous.value) return conversationsStore.create()
  const conversation = makeEphemeralConversation(content, identity)
  conversationsStore.addEphemeral(conversation)
  return conversation
}
/**
 * 真正发请求：匿名开一次性流，登录 createRun 再订 SSE。
 * 工作区代数变化（登出）时立刻放弃，避免把结果写进新会话。
 */
async function dispatch(content: string, prepared: PreparedImage | undefined, operation: 'send' | 'regenerate' | 'edit_and_fork', source?: UserMessage): Promise<void> {
  const epoch = workspaceEpoch
  const clientRequestId = toPublicId(randomId())
  const conversation = await ensureConversation(content, clientRequestId)
  if (epoch !== workspaceEpoch) return
  if (isAnonymous.value) {
    const sourceTurn = operation === 'regenerate' && source ? conversation.turns.find(turn => turn.user.id === source.id) : undefined
    if (operation === 'regenerate' && !sourceTurn) throw new Error('找不到需要重新生成的原问题')
    // 必须在 attachRun 之前截取，否则当前问题会同时出现在 history 与 content。
    const history = historyFor(conversation, sourceTurn?.id)
    const run = createAnonymousRun(clientRequestId, conversation.id, operation, sourceTurn)
    conversationsStore.attachRun(run, content, Boolean(prepared), operation)
    runsStore.register(run)
    anonymousRunIds.add(run.run_id)
    runTransportManager.startAnonymous(run, callbacks(run, operation, true, sourceTurn?.id), {
      client_request_id: clientRequestId,
      // 首轮的 ephemeral-* 只是浏览器占位符；收到服务端 id 后，后续轮次始终复用它。
      ...(conversation.id.startsWith('ephemeral-') ? {} : { conversation_id: conversation.id }),
      content,
      history,
      reasoning_effort: 'low'
    }, prepared?.blob)
  } else {
    const run = await aiApi.createRun({ client_request_id: clientRequestId, operation, conversation_id: conversation.id, source_message_id: source?.id, content, reasoning_effort: 'low', image: prepared?.blob })
    if (epoch !== workspaceEpoch) return
    conversationsStore.attachRun(run, content, Boolean(prepared), operation)
    runsStore.register(run)
    runTransportManager.startLogin(run, callbacks(run, operation, false), 0)
  }
  draft.value = ''
  revokeImage()
}
/**
 * 用户提交入口。已有进行中的 Run 或服务关闭时直接忽略。
 * 若登录态刚过期，清掉 user 后按匿名再试一次。
 */
async function submit(content: string, prepared?: PreparedImage, operation: 'send' | 'regenerate' | 'edit_and_fork' = 'send', source?: UserMessage): Promise<void> {
  if (activeRun.value || serviceDisabled.value) return
  try {
    await dispatch(content, prepared, operation, source)
  } catch (error) {
    if (isAuthFailure(error)) {
      userStore.setUser(null)
      await nextTick()
      try {
        await dispatch(content, prepared, 'send')
        return
      } catch (retryError) {
        toast.error(displayError(retryError, '发送失败，请稍后再试'))
        return
      }
    }
    toast.error(displayError(error, '发送失败，请稍后再试'))
  }
}
function submitDraft(prepared?: PreparedImage): Promise<void> { const source = editingMessage.value; editingMessage.value = undefined; return submit(draft.value, prepared, source && !isAnonymous.value ? 'edit_and_fork' : 'send', source) }
type TerminalRunEvent = Extract<RunEvent, { type: 'run.completed' | 'run.stopped' | 'run.failed' }>
const terminalEventTypes = new Set<RunEvent['type']>(['run.completed', 'run.stopped', 'run.failed'])
function isTerminalEvent(event: RunEvent): event is TerminalRunEvent { return terminalEventTypes.has(event.type) }

/** 终态提交后的低频业务副作用，不参与 delta 调度。 */
function handleCommittedTerminal(event: TerminalRunEvent, state: ClientRunState | undefined, operation: RunOperation, anonymous: boolean): void {
  if (anonymous) {
    anonymousRunIds.delete(event.run_id)
    void bootstrapStore.load({ quiet: true }).catch(() => undefined)
  }
  if (operation === 'regenerate' && !anonymous && ['run.completed', 'run.stopped'].includes(event.type) && state && !syncedRegenerations.has(event.run_id)) {
    syncedRegenerations.add(event.run_id)
    void conversationsStore.selectVersion(state.conversationId, state.turnId, state.assistantMessageId).catch(() => { toast.error('回答已保存，但版本选择同步失败；刷新后可重新选择。') })
  }
}

/** 一批事件只提交一次 Run snapshot，并只投影一次助手消息。 */
function commitRunEvents(events: readonly RunEvent[], operation: RunOperation, anonymous: boolean): void {
  if (!events.length) return
  for (const event of events) conversationsStore.applyRunEvent(event)
  const state = runsStore.ingestBatch(events)
  if (state) conversationsStore.syncRun(state)
  const terminal = [...events].reverse().find(isTerminalEvent)
  if (terminal) handleCommittedTerminal(terminal, state, operation, anonymous)
}

/**
 * 绑定到某次 Run 的传输回调。boundRunId 会在 run.created 时从占位 ID 换成服务端 ID。
 * transport 负责逐帧协议校验；scheduler 负责有界 UI 批量提交。
 */
function callbacks(run: RunRecord, operation: RunOperation = 'send', anonymous = false, anonymousTargetTurnId?: TurnId) {
  let boundRunId = run.run_id
  runEventRenderScheduler.open(boundRunId, events => commitRunEvents(events, operation, anonymous))
  return {
    onEvent: (event: Parameters<typeof runsStore.ingest>[0]) => {
      if (event.type === 'run.created') {
        runEventRenderScheduler.flushNow(boundRunId)
        runTransportManager.rebind(boundRunId, event.run_id)
        runEventRenderScheduler.rebind(boundRunId, event.run_id)
        if (anonymous) {
          anonymousRunIds.delete(boundRunId)
          anonymousRunIds.add(event.run_id)
        }
        runsStore.adoptServerCreated(boundRunId, event, anonymousTargetTurnId)
        conversationsStore.applyRunEvent(event, boundRunId, anonymousTargetTurnId)
        boundRunId = event.run_id
        const created = runsStore.byId[boundRunId]
        if (created) conversationsStore.syncRun(created)
      } else {
        runEventRenderScheduler.enqueue(boundRunId, event)
      }
    },
    onReset: () => {
      runEventRenderScheduler.discard(boundRunId)
      runsStore.resetForReplay(boundRunId)
      const reset = runsStore.byId[boundRunId]
      if (reset) conversationsStore.syncRun(reset)
    },
    onConnection: (connection: Parameters<typeof runsStore.setConnection>[1], attempt: number) => runsStore.setConnection(boundRunId, connection, attempt),
    onError: (error: Error) => {
      runEventRenderScheduler.close(boundRunId, 'flush')
      if (anonymous) anonymousRunIds.delete(boundRunId)
      runsStore.setError(boundRunId, { code: 'TRANSPORT_ERROR', message: error.message, retryable: !anonymous })
    }
  }
}
/** 停止当前生成。匿名直接掐流；登录发 cancel 并等 SSE 终态，失败则用 getRun 对账。 */
async function stop(): Promise<void> {
  const run = activeRun.value
  if (!run) return
  runEventRenderScheduler.flushNow(run.runId)
  const previous = runsStore.markStopping(run.runId)
  if (!previous) return
  const stopping = runsStore.byId[run.runId]
  if (stopping) conversationsStore.syncRun(stopping)
  if (isAnonymous.value) {
    runTransportManager.stop(run.runId)
    runEventRenderScheduler.close(run.runId, 'discard')
    anonymousRunIds.delete(run.runId)
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
    try {
      const authoritative = await aiApi.getRun(run.runId)
      runsStore.reconcileRun(authoritative)
      const reconciled = runsStore.byId[run.runId]
      if (reconciled) conversationsStore.syncRun(reconciled)
      if (isTerminalRunState(authoritative.state)) {
        runTransportManager.stop(run.runId)
        runEventRenderScheduler.close(run.runId, 'discard')
      } else {
        replayRunFromStart(run.runId)
      }
    } catch {
      runsStore.restoreAfterStopFailure(run.runId, previous)
      runsStore.setError(run.runId, { code: 'RUN_STATUS_UNKNOWN', message: '停止结果暂时无法确认，请重新核对', retryable: true })
      replayRunFromStart(run.runId)
    }
    toast.error(error instanceof Error ? error.message : '停止失败，请稍后再试')
  }
}
function choosePrompt(prompt: string): void { draft.value = prompt }
async function selectConversation(id: ConversationId): Promise<void> { try { await conversationsStore.select(id); await router.replace({ query: { conversation: id } }); if (isNarrow.value) drawerOpen.value = false } catch (error) { toast.error(error instanceof Error ? error.message : '会话加载失败，请稍后再试') } }
async function newConversation(): Promise<void> { try { if (!isAnonymous.value) await conversationsStore.create(); else { const conversation = makeEphemeralConversation('未命名对话'); conversationsStore.addEphemeral(conversation) } draft.value = ''; if (isNarrow.value) drawerOpen.value = false } catch (error) { toast.error(error instanceof Error ? error.message : '新建会话失败，请稍后再试') } }
async function rename(id: ConversationId, title: string): Promise<void> { try { await conversationsStore.rename(id, title) } catch { toast.error('重命名失败，原名称已恢复') } }
function requestRemove(id: ConversationId): void { pendingDelete.value = id }
async function confirmRemove(): Promise<void> {
  const id = pendingDelete.value
  pendingDelete.value = null
  if (!id) return
  try {
    const runId = conversationsStore.byId[id]?.active_run_id
    if (runId) {
      runTransportManager.stop(runId)
      runEventRenderScheduler.close(runId, 'discard')
      anonymousRunIds.delete(runId)
    }
    await conversationsStore.remove(id)
  } catch { toast.error('删除失败，请稍后再试') }
}
function editMessage(message: UserMessage): void { editingMessage.value = message; draft.value = message.content }
/**
 * 重新生成。附图的一轮无法从历史恢复图片，改为把原文填回输入框。
 * 匿名没有版本，清空 currentId 后当作新对话再发一遍。
 */
async function regenerateTurn(turnId: string): Promise<void> { const turn = current.value?.turns.find(item => item.id === turnId); if (!turn || activeRun.value) return; if (turn.user.had_image) { toast.info('这轮包含图片，重新生成前请重新附图。'); editingMessage.value = turn.user; draft.value = turn.user.content; return } await submit(turn.user.content, undefined, 'regenerate', turn.user) }
/** 达到输出上限后，发一条「请继续」作为新 turn，而不是改写已停止的消息。 */
async function continueTurn(turnId: string): Promise<void> { const turn = current.value?.turns.find(item => item.id === turnId); if (!turn || activeRun.value) return; await submit('请从上一条回答中断的位置继续，不要重复已经完成的内容。') }
async function selectVersion(turnId: string, messageId: Parameters<typeof conversationsStore.selectVersion>[2]): Promise<void> { if (!currentId.value) return; if (current.value?.source === 'ephemeral') conversationsStore.selectLocalVersion(currentId.value, turnId, messageId); else await conversationsStore.selectVersion(currentId.value, turnId, messageId) }
/** 登录流断线后通常从 lastSeq 续订；停止结果不确定时传 0，强制完整回放。 */
function reconnect(runId: string, after = runsStore.byId[runId]?.lastSeq ?? 0): void { const run = runsStore.byId[runId]; if (run) { const turn = conversationsStore.byId[run.conversationId]?.turns.find(item => item.id === run.turnId); const record: RunRecord = { run_id: run.runId, operation: run.operation, conversation_id: run.conversationId, turn_id: run.turnId, user_message_id: turn?.user.id ?? run.assistantMessageId, assistant_message_id: run.assistantMessageId, state: run.state, events_url: '', reservation: { reserved_micro_cny: 0, price_version: 0 } }; runTransportManager.startLogin(record, callbacks(record, record.operation, false), after) } }
/** 关闭可能仍在推进序号的旧流，清空临时正文，再从服务端事件 1 重建。 */
function replayRunFromStart(runId: RunId): void {
  runTransportManager.stop(runId)
  runEventRenderScheduler.close(runId, 'discard')
  runsStore.resetForReplay(runId)
  const reset = runsStore.byId[runId]
  if (reset) conversationsStore.syncRun(reset)
  reconnect(runId, 0)
}
function applyImage(value: PreparedImage): void { revokeImage(); image.value = value }
function copy(text: string): void { if (!navigator.clipboard) { toast.info('已选中回答，请使用 Ctrl/Cmd+C 复制'); return } void navigator.clipboard.writeText(text).then(() => { toast.success('已复制') }).catch(() => { toast.error('复制失败，请手动选择文本') }) }
function discardImport(): void { importOpen.value = false; conversationsStore.discardEphemeral() }
async function confirmImport(): Promise<void> { try { await conversationsStore.importEphemeral(); importOpen.value = false } catch { toast.error('导入失败，临时副本仍保留') } }
/** 登出时关掉所有 SSE、清空 store，并去掉 URL 上的 conversation 查询参数。 */
function resetSignedInWorkspace(): void {
  workspaceEpoch += 1
  runTransportManager.closeAll()
  runEventRenderScheduler.closeAll('discard')
  anonymousRunIds.clear()
  conversationsStore.clear()
  runsStore.clear()
  bootstrapStore.discard()
  syncedRegenerations.clear()
  pendingDelete.value = null
  importOpen.value = false
  editingMessage.value = undefined
  draft.value = ''
  revokeImage()
  if (route.query.conversation) void router.replace({ query: {} })
}

/** 进入页面：bootstrap → 列表 → 恢复未完成 Run 并续订 SSE。匿名只拉 bootstrap。 */
async function load(): Promise<void> {
  const epoch = workspaceEpoch
  await bootstrapStore.load().catch(() => undefined)
  if (epoch !== workspaceEpoch || !isAuthenticated.value) return
  try {
    await conversationsStore.load()
    if (epoch !== workspaceEpoch || !isAuthenticated.value) {
      conversationsStore.clear()
      runsStore.clear()
      return
    }
    const active = await aiApi.activeRuns()
    if (epoch !== workspaceEpoch || !isAuthenticated.value) {
      conversationsStore.clear()
      runsStore.clear()
      return
    }
    for (const run of active) {
      if (epoch !== workspaceEpoch || !isAuthenticated.value) return
      await conversationsStore.hydrate(run.conversation_id)
      if (epoch !== workspaceEpoch || !isAuthenticated.value) return
      conversationsStore.attachRecoveredRun(run)
      conversationsStore.markRunActive(run)
      runsStore.register(run)
      runTransportManager.startLogin(run, callbacks(run, run.operation, false), 0)
    }
    const requested = route.query.conversation
    if (typeof requested === 'string' && conversationsStore.byId[requested]) await conversationsStore.select(toConversationId(requested))
  } catch (error) {
    if (epoch !== workspaceEpoch) return
    if (isAuthFailure(error)) {
      userStore.setUser(null)
      return
    }
    toast.error(displayError(error, '历史加载失败，请稍后再试'))
  }
}
watch(() => route.query.conversation, value => { if (typeof value === 'string' && conversationsStore.byId[value]) void conversationsStore.select(toConversationId(value)) }, { immediate: true })
watch(isAuthenticated, (authenticated, wasAuthenticated) => {
  if (authenticated && ephemeral.value.length) importOpen.value = true
  if (!wasAuthenticated || authenticated) return
  resetSignedInWorkspace()
  void bootstrapStore.load({ quiet: true }).catch(() => undefined)
})
onMounted(() => { narrowQuery?.addEventListener('change', onNarrowChange); window.addEventListener('keydown', onGlobalKeydown); void load() })
onBeforeUnmount(() => {
  narrowQuery?.removeEventListener('change', onNarrowChange)
  window.removeEventListener('keydown', onGlobalKeydown)
  runTransportManager.closeAnonymous()
  for (const runId of anonymousRunIds) runEventRenderScheduler.close(runId, 'discard')
  anonymousRunIds.clear()
  revokeImage()
})
</script>

<template>
  <main class="ai-shell">
    <ChatSidebar
      :key="isAuthenticated ? 'signed-in' : 'anonymous'"
      :items="items"
      :current-id="currentId"
      :collapsed="collapsed"
      :floating="isNarrow"
      :open="drawerOpen"
      :loading="conversationsStore.loading"
      :can-search="isAuthenticated"
      :show-login="!isAuthenticated"
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
          <span v-if="anonymousQuotaText" class="quota">{{ anonymousQuotaText }}</span>
          <AccountMenu v-if="isAuthenticated" />
          <router-link v-if="!isAuthenticated" to="/login" class="topbar-link"><AppIcon name="log-in" :size="14" /><span>登录保存历史</span></router-link>
          <router-link v-else-if="user?.role === 'admin'" to="/admin" class="topbar-link">管理</router-link>
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
