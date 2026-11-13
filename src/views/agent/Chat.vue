<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { Grid } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'
import SessionSidebar from '@/components/agent/chat/SessionSidebar.vue'
import MessageList from '@/components/agent/chat/MessageList.vue'
import { useAgentChatStore } from '@/stores/agent/chat'
import { useUserStore } from '@/stores/user'
import { terminal } from '@/features/agent/chat/model'

/** 路由页组合侧栏、阅读区和输入区，业务状态及传输由工作区管理。 */
const store = useAgentChatStore()
const user = useUserStore()
const route = useRoute()
const router = useRouter()
const screens = Grid.useBreakpoint()
const mobile = computed(() => !screens.value.md)
const drawer = shallowRef(false) // 仅控制窄屏导航展示。
// 三项勾选在当前会话内保留，切换会话时复位。
const allowDownload = shallowRef(false) // 允许下载公开文件。
const allowExport = shallowRef(false) // 允许生成导出附件。
const allowMcp = shallowRef(false) // 允许调用外部 MCP 工具。
const mcpToolName = /^mcp_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$/ // 只识别后端固定命名空间。
const currentRun = computed(() => store.current?.current_run_id ? store.runs[store.current.current_run_id] : undefined)
const network = computed(() => currentRun.value ? store.connections[currentRun.value.run_id] : undefined)
/** 根据当前运行生成状态文案，停止、断线和保存状态优先于工具活动。 */
const runFeedback = computed(() => {
  const run = currentRun.value
  if (!run) return ''
  if (run.persistence_status === 'failed') return '历史保存失败，回答仍保留在当前服务中，请重试保存'
  if (run.status === 'stopping') return '正在停止，等待运行收尾'
  if (network.value === 'reconnecting') return '连接中断，正在恢复已生成的输出'
  if (network.value === 'failed') return '连接恢复失败，可手动重连'
  if (terminal(run.status)) return '正在保存本轮记录'
  if (run.activity === 'summarizing') return '正在整理上下文'
  if (run.activity === 'context_loading') return '正在读取历史上下文'
  if (run.activity === 'reducing') return '正在缩减历史上下文'
  if (run.activity === 'tool_running') {
    if (run.tool_name === 'knowledge_list') return '正在查看可用知识库'
    if (run.tool_name === 'knowledge_search') return '正在检索知识库'
    if (run.tool_name === 'history_recall') return '正在回查本会话历史'
    if (run.tool_name === 'web_search') return '正在搜索网页'
    if (run.tool_name === 'web_fetch') return '正在读取网页正文'
    if (run.tool_name === 'file_download') return '正在下载文件'
    if (run.tool_name === 'pdf_export') return '正在生成 PDF'
    if (run.tool_name === 'text_export') return '正在导出文本文件'
    if (run.tool_name && mcpToolName.test(run.tool_name)) return '正在调用 MCP 工具'
    return '正在运行工具'
  }
  if (run.activity === 'model_processing') return '模型正在处理请求'
  return '正在生成回答'
})
/** 只将活动绑定到本次运行的助手消息，等待消息快照时保留工作区的重连入口。 */
const activeReply = computed(() => {
  const run = currentRun.value
  if (!run || !store.current?.messages?.some(message =>
    message.role === 'assistant' && message.message_id === run.message_id && message.run_id === run.run_id
  )) return undefined

  return {
    messageId: run.message_id,
    label: runFeedback.value,
    toolNotice: run.tool_notice,
    reconnectable: network.value === 'failed',
    updating: network.value !== 'failed' && run.persistence_status !== 'failed',
  }
})
/** 后台关闭许可时显示关闭；旧回答按实际内容展示，与此开关无关。 */
const thinkingAllowed = computed(() => !!store.bootstrap?.model?.thinking_allowed)
const thinkingSelected = computed(() => thinkingAllowed.value && !!store.current?.thinking_preference)
const draft = computed({ get: () => store.drafts[store.selected] ?? '', set: text => { store.drafts[store.selected] = text } })
const byteCount = computed(() => new TextEncoder().encode(draft.value).byteLength)
const maxInput = computed(() => store.bootstrap?.limits.max_input_bytes ?? 16384)
const canSend = computed(() => !!store.current && !!store.bootstrap?.available && !currentRun.value && !!draft.value.trim() && byteCount.value <= maxInput.value && !store.sending[store.selected] && !store.preferenceSaving[store.selected])

/** 将操作失败统一呈现在一个可访问的提示区域。 */
async function act(operation: () => Promise<void>): Promise<void> { try { await operation() } catch (error) { await store.report(error) } }
/** 选择会话只关闭抽屉，不关闭运行订阅。 */
async function select(id: string): Promise<void> { drawer.value = false; await act(() => store.select(id)) }
/** 窗口获得焦点时刷新，发现其他标签页的运行和模型可用状态变化。 */
function focus(): void { void act(() => store.restore()) }
/** 将当前勾选交给发送请求，重试时工作区会复用已冻结的授权。 */
function submit(): void {
  if (!canSend.value) return
  const download = allowDownload.value
  const exportFile = allowExport.value
  const mcp = allowMcp.value
  void act(() => store.send(download, exportFile, mcp))
}
/** Ctrl/Cmd+Enter 发送消息，普通 Enter 仍用于多行输入。 */
function keyboard(event: KeyboardEvent): void { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing && canSend.value) { event.preventDefault(); submit() } }
watch(() => store.selected, id => {
  allowDownload.value = false
  allowExport.value = false
  allowMcp.value = false
  void router.replace({ query: id ? { chat: id } : {} })
})
onMounted(() => { void act(() => store.restore(typeof route.query.chat === 'string' ? route.query.chat : '')); window.addEventListener('focus', focus) })
onBeforeUnmount(() => { window.removeEventListener('focus', focus); store.dispose() })
</script>

<template>
  <div class="agent-workspace">
    <aside v-if="!mobile" class="agent-sidebar"><SessionSidebar :chats="store.list" :selected="store.selected" :busy="store.loading" :has-more="!!store.listCursor" @more="act(store.moreChats)" @select="select" @create="act(store.create)" @rename="(id, title) => act(() => store.rename(id, title))" @remove="id => act(() => store.remove(id))" /></aside>
    <a-drawer v-model:open="drawer" title="历史会话" placement="left" :width="288" :body-style="{ padding: 0 }"><SessionSidebar :chats="store.list" :selected="store.selected" :busy="store.loading" :has-more="!!store.listCursor" @more="act(store.moreChats)" @select="select" @create="act(store.create)" @rename="(id, title) => act(() => store.rename(id, title))" @remove="id => act(() => store.remove(id))" /></a-drawer>
    <main class="agent-main">
      <header class="agent-header"><a-space><a-button v-if="mobile" @click="drawer = true">会话</a-button><div><h1>{{ store.current?.title ?? '智能体工作区' }}</h1><span class="agent-caption">{{ currentRun?.model.model ?? store.bootstrap?.model?.model ?? '尚无可用模型' }} · 历史多会话</span></div></a-space><a-space><a-button :loading="store.loading" @click="focus">刷新</a-button><RouterLink v-if="user.user?.role === 'admin'" to="/admin/agent/model-configs">模型管理</RouterLink></a-space></header>
      <!-- 会话快照尚未载入时，用户仍可处理断线并重新获取输出。 -->
      <div v-if="!activeReply && (store.notice || network === 'failed')" class="agent-feedback">
        <span role="status">{{ network === 'failed' ? runFeedback : store.notice }}</span>
        <a-button v-if="network === 'failed' && currentRun" size="small" @click="act(() => store.reconnect(currentRun!.run_id))">重新连接</a-button>
      </div>
      <a-alert v-if="store.bootstrap && !store.bootstrap.available" class="agent-alert" type="warning" show-icon message="当前没有可用模型，新发送暂不可用。已有回答仍可查看。" />
      <MessageList v-if="store.current" :messages="store.current.messages ?? []" :chat-id="store.current.chat_id"
        :active-reply="activeReply" :has-more="!!store.current.next_cursor" :loading="!!store.pageLoading[store.selected]"
        @older="act(() => store.older(store.selected))" @reconnect="id => act(() => store.reconnect(id))" />
      <div v-else class="agent-empty"><h2>独立的上下文，安静地交流</h2><p>新建会话开始；切换会话时，其他回答会继续生成。</p><a-button type="primary" :disabled="!store.bootstrap" @click="act(store.create)">新建会话</a-button></div>
      <form v-if="store.current" class="agent-composer" @submit.prevent="submit">
        <label for="agent-input">发送消息</label><a-textarea id="agent-input" v-model:value="draft" :auto-size="{ minRows: 2, maxRows: 7 }" :disabled="!!currentRun || store.sending[store.selected]" placeholder="写下问题，Ctrl / ⌘ + Enter 发送" @keydown="keyboard" />
        <div class="thinking-mode"><a-button html-type="button" :type="thinkingSelected ? 'primary' : 'default'" :aria-pressed="thinkingSelected" :disabled="!thinkingAllowed || !!store.pending[store.selected] || !!store.sending[store.selected] || !!store.preferenceSaving[store.selected]" @click="act(() => store.setThinking(!thinkingSelected))">深度思考：{{ thinkingSelected ? '开' : '关' }}</a-button><span>{{ thinkingAllowed ? '仅影响下一次发送' : '当前模型未允许深度思考' }}</span></div>
        <div class="thinking-mode"><a-checkbox v-model:checked="allowDownload"
          :disabled="!!currentRun || !!store.pending[store.selected] || !!store.sending[store.selected]">允许下载文件</a-checkbox>
          <a-checkbox v-model:checked="allowExport"
            :disabled="!!currentRun || !!store.pending[store.selected] || !!store.sending[store.selected]">允许导出文件</a-checkbox>
          <a-checkbox :checked="store.pending[store.selected]?.mcp ?? allowMcp" aria-describedby="agent-mcp-help"
            :disabled="!!currentRun || !!store.pending[store.selected] || !!store.sending[store.selected]"
            @update:checked="(value: boolean) => allowMcp = value">允许使用 MCP 工具</a-checkbox>
          <span v-show="store.pending[store.selected]?.mcp ?? allowMcp" id="agent-mcp-help">本轮所需的工具参数可能发送给外部服务</span>
        </div>
        <div class="composer-footer"><span :class="{ 'input-over-limit': byteCount > maxInput }">{{ byteCount }} / {{ maxInput }} 字节<span v-if="store.pending[store.selected]"> · 上次发送待核对，重试将复用原模式与请求标识</span></span><a-button v-if="currentRun?.persistence_status === 'failed'" @click="act(() => store.save(currentRun!.run_id))">重试保存</a-button><a-button v-else-if="currentRun && !terminal(currentRun.status)" :loading="currentRun.status === 'stopping'" @click="act(() => store.stop(currentRun!.run_id))">停止生成</a-button><a-button v-else html-type="submit" type="primary" :disabled="!canSend" :loading="store.sending[store.selected]">{{ store.pending[store.selected] ? '重试并核对' : '发送' }}</a-button></div>
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
.agent-feedback { padding: 10px 24px; font-size: 13px; color: var(--agent-muted); display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.agent-alert { margin: 0 24px 12px; }.agent-empty { margin: auto; padding: 24px; text-align: center; }.agent-empty h2 { font-size: 24px; }.agent-empty p { color: var(--agent-muted); line-height: 1.8; }
.agent-composer { padding: 16px max(20px, calc((100% - 800px) / 2)); background: var(--agent-surface); border-top: 1px solid var(--agent-border); }.agent-composer label { display: block; margin-bottom: 8px; font-weight: 500; }
.composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }.composer-footer span { font-size: 12px; color: var(--agent-muted); }.composer-footer .input-over-limit { color: #b42318; }
.thinking-mode { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 12px; }.thinking-mode span { color: var(--agent-muted); font-size: 13px; }
@media(max-width:767px){.agent-header{padding:12px 16px}.agent-feedback{padding:8px 16px}.agent-alert{margin:0 16px 8px}.agent-composer{padding:12px 16px}}
</style>
