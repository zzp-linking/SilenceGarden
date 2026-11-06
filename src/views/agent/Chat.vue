<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { Grid } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'
import SessionSidebar from '@/components/agent/chat/SessionSidebar.vue'
import MessageList from '@/components/agent/chat/MessageList.vue'
import { useAgentChatStore } from '@/stores/agent/chat'
import { useUserStore } from '@/stores/user'

/** 路由页组合侧栏、阅读区和输入区，业务状态及传输由工作区管理。 */
const store = useAgentChatStore()
const user = useUserStore()
const route = useRoute()
const router = useRouter()
const screens = Grid.useBreakpoint()
const mobile = computed(() => !screens.value.md)
const drawer = shallowRef(false) // 仅控制窄屏导航展示。
const currentRun = computed(() => store.current?.current_run_id ? store.runs[store.current.current_run_id] : undefined)
const network = computed(() => currentRun.value ? store.connections[currentRun.value.run_id] : undefined)
/** 断线和停止状态优先展示，避免其他运行的旧操作提示遮盖真实状态。 */
const feedback = computed(() => network.value === 'reconnecting' ? '连接中断，正在恢复已生成的输出' : network.value === 'failed' ? '连接恢复失败，可手动重连' : currentRun.value?.status === 'stopping' ? '正在停止，等待运行收尾' : store.notice || (currentRun.value ? '正在生成回答' : '会话仅在服务进程中保留'))
const draft = computed({ get: () => store.drafts[store.selected] ?? '', set: text => { store.drafts[store.selected] = text } })
const byteCount = computed(() => new TextEncoder().encode(draft.value).byteLength)
const maxInput = computed(() => store.bootstrap?.limits.max_input_bytes ?? 16384)
const canSend = computed(() => !!store.current && !!store.bootstrap?.available && !currentRun.value && !!draft.value.trim() && byteCount.value <= maxInput.value && !store.sending[store.selected])

/** 将操作失败统一呈现在一个可访问的提示区域。 */
async function act(operation: () => Promise<void>): Promise<void> { try { await operation() } catch (error) { await store.report(error) } }
/** 选择会话只关闭抽屉，不关闭运行订阅。 */
async function select(id: string): Promise<void> { drawer.value = false; await act(() => store.select(id)) }
/** 窗口获得焦点时刷新，发现其他标签页的运行和模型可用状态变化。 */
function focus(): void { void act(() => store.restore()) }
/** Ctrl/Cmd+Enter 发送消息，普通 Enter 仍用于多行输入。 */
function keyboard(event: KeyboardEvent): void { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing && canSend.value) { event.preventDefault(); void act(store.send) } }
watch(() => store.selected, id => { void router.replace({ query: id ? { chat: id } : {} }) })
onMounted(() => { void act(() => store.restore(typeof route.query.chat === 'string' ? route.query.chat : '')); window.addEventListener('focus', focus) })
onBeforeUnmount(() => { window.removeEventListener('focus', focus); store.dispose() })
</script>

<template>
  <div class="agent-workspace">
    <aside v-if="!mobile" class="agent-sidebar"><SessionSidebar :chats="store.list" :selected="store.selected" :busy="store.loading" @select="select" @create="act(store.create)" @rename="(id, title) => act(() => store.rename(id, title))" @remove="id => act(() => store.remove(id))" /></aside>
    <a-drawer v-model:open="drawer" title="临时会话" placement="left" :width="288" :body-style="{ padding: 0 }"><SessionSidebar :chats="store.list" :selected="store.selected" :busy="store.loading" @select="select" @create="act(store.create)" @rename="(id, title) => act(() => store.rename(id, title))" @remove="id => act(() => store.remove(id))" /></a-drawer>
    <main class="agent-main">
      <header class="agent-header"><a-space><a-button v-if="mobile" @click="drawer = true">会话</a-button><div><h1>{{ store.current?.title ?? '智能体工作区' }}</h1><span class="agent-caption">{{ currentRun?.model.model ?? store.bootstrap?.model?.model ?? '尚无可用模型' }} · 临时多会话</span></div></a-space><a-space><a-button :loading="store.loading" @click="focus">刷新</a-button><RouterLink v-if="user.user?.role === 'admin'" to="/admin/agent/model-configs">模型管理</RouterLink></a-space></header>
      <div class="agent-feedback" role="status" aria-live="polite" aria-atomic="true">{{ feedback }}<a-button v-if="network === 'failed' && currentRun" size="small" @click="act(() => store.reconnect(currentRun!.run_id))">重新连接</a-button></div>
      <a-alert v-if="store.bootstrap && !store.bootstrap.available" class="agent-alert" type="warning" show-icon message="当前没有可用模型，新发送暂不可用。已有回答仍可查看。" />
      <MessageList v-if="store.current" :messages="store.current.messages ?? []" :chat-id="store.current.chat_id" />
      <div v-else class="agent-empty"><h2>独立的上下文，安静地交流</h2><p>新建临时会话开始；切换会话时，其他回答会继续生成。</p><a-button type="primary" :disabled="!store.bootstrap" @click="act(store.create)">新建会话</a-button></div>
      <form v-if="store.current" class="agent-composer" @submit.prevent="act(store.send)">
        <label for="agent-input">发送消息</label><a-textarea id="agent-input" v-model:value="draft" :auto-size="{ minRows: 2, maxRows: 7 }" :disabled="!!currentRun || store.sending[store.selected]" placeholder="写下问题，Ctrl / ⌘ + Enter 发送" @keydown="keyboard" />
        <div class="composer-footer"><span :class="{ 'input-over-limit': byteCount > maxInput }">{{ byteCount }} / {{ maxInput }} 字节<span v-if="store.pending[store.selected]"> · 上次发送待核对，重试将复用请求标识</span></span><a-button v-if="currentRun" :loading="currentRun.status === 'stopping'" @click="act(() => store.stop(currentRun!.run_id))">停止生成</a-button><a-button v-else html-type="submit" type="primary" :disabled="!canSend" :loading="store.sending[store.selected]">{{ store.pending[store.selected] ? '重试并核对' : '发送' }}</a-button></div>
      </form>
    </main>
  </div>
</template>

<style scoped>
.agent-workspace { --agent-primary: #1677ff; --agent-canvas: #f5f7fa; --agent-surface: #fff; --agent-border: #d9e1ea; --agent-selected: #e6f4ff; --agent-muted: #595959; color: #262626; background: var(--agent-canvas); display: flex; height: 100vh; height: 100dvh; --whisper-line: #d9e1ea; --whisper-mist: #f5f7fa; --whisper-ink-faint: #595959; --whisper-blue-deep: #0958d9; --whisper-hover: #e6f4ff; --whisper-focus: #1677ff; }
.agent-sidebar { width: 264px; flex-shrink: 0; background: var(--agent-surface); border-right: 1px solid var(--agent-border); }
.agent-main { min-width: 0; display: flex; flex: 1; flex-direction: column; }
.agent-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 16px 24px; background: var(--agent-surface); border-bottom: 1px solid var(--agent-border); }
.agent-header h1 { font-size: 18px; margin: 0; }.agent-caption { font-size: 12px; color: var(--agent-muted); }
.agent-feedback { padding: 10px 24px; font-size: 13px; color: var(--agent-muted); min-height: 40px; display: flex; align-items: center; gap: 12px; }
.agent-alert { margin: 0 24px 12px; }.agent-empty { margin: auto; padding: 24px; text-align: center; }.agent-empty h2 { font-size: 24px; }.agent-empty p { color: var(--agent-muted); line-height: 1.8; }
.agent-composer { padding: 16px max(20px, calc((100% - 800px) / 2)); background: var(--agent-surface); border-top: 1px solid var(--agent-border); }.agent-composer label { display: block; margin-bottom: 8px; font-weight: 500; }
.composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }.composer-footer span { font-size: 12px; color: var(--agent-muted); }.composer-footer .input-over-limit { color: #b42318; }
@media(max-width:767px){.agent-header{padding:12px 16px}.agent-feedback{padding:8px 16px}.agent-alert{margin:0 16px 8px}.agent-composer{padding:12px 16px}}
</style>
