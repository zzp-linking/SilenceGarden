import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it, vi } from 'vitest'
import { agentChatApi } from '@/api/agentChat'
import type { AgentChat, AgentEvent, AgentRun } from '@/features/agent/chat/model'
import { useAgentChatStore } from '@/stores/agent/chat'
import { antdPlugins, installAntdEnvironment } from '@/testsupport/antd'
import Chat from './Chat.vue'

/** 验证输入区的三项授权跨轮保留，并且不会带入另一会话。 */
it('同一会话连续发送时保留工具勾选，切换会话后关闭', async () => {
  installAntdEnvironment()
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAgentChatStore()
  store.bootstrap = {
    instance_id: 'test-instance',
    available: true,
    limits: { max_input_bytes: 16384, user_concurrency: 2, user_max_chats: 12, max_messages: 128 },
  }
  store.chats.first = { chat_id: 'first', title: '第一个会话', revision: 1, updated_at: '', messages: [] }
  store.chats.second = { chat_id: 'second', title: '第二个会话', revision: 1, updated_at: '', messages: [] }
  store.selected = 'first'
  vi.spyOn(store, 'restore').mockResolvedValue(undefined)
  const send = vi.spyOn(store, 'send').mockResolvedValue(undefined)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Chat }] })
  await router.push('/')
  const wrapper = mount(Chat, {
    global: { plugins: [pinia, router, ...antdPlugins], stubs: { SessionSidebar: true, MessageList: true } },
  })
  try {
    const names = ['允许下载文件', '允许导出文件', '允许使用 MCP 工具']
    const checkboxes = names.map(name => {
      const label = wrapper.findAll('label').find(item => item.text() === name)
      if (!label) throw new Error(`找不到工具勾选项 ${name}`)
      return label.get<HTMLInputElement>('input[type="checkbox"]')
    })
    for (const checkbox of checkboxes) await checkbox.setValue(true)

    for (const text of ['第一次发送', '第二次发送']) {
      await wrapper.get('textarea').setValue(text)
      await wrapper.get('form').trigger('submit')
      expect(send).toHaveBeenLastCalledWith(true, true, true)
      expect(checkboxes.every(checkbox => checkbox.element.checked)).toBe(true)
    }
    expect(send).toHaveBeenCalledTimes(2)

    await checkboxes[2].setValue(false)
    await wrapper.get('textarea').setValue('手动关闭 MCP 后发送')
    await wrapper.get('form').trigger('submit')
    expect(send).toHaveBeenLastCalledWith(true, true, false)

    store.selected = 'second'
    await nextTick()
    expect(checkboxes.every(checkbox => !checkbox.element.checked)).toBe(true)
  } finally {
    wrapper.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

/** 用实际 SSE 订阅验证提示的消息归属和结束后的界面状态。 */
it('在当前助手回复内更新工具活动、执行步骤和重连入口', async () => {
  installAntdEnvironment()
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAgentChatStore()
  store.bootstrap = {
    instance_id: 'test-instance', available: true,
    limits: { max_input_bytes: 16384, user_concurrency: 2, user_max_chats: 12, max_messages: 128 },
  }
  const run: AgentRun = {
    instance_id: 'test-instance', chat_id: 'first', run_id: 'run', user_message_id: 'question', message_id: 'reply',
    answer: '', reasoning: '', event_seq: 0, status: 'running', activity: 'summarizing', persistence_status: 'pending',
    model: { id: 'model', name: '测试模型', provider: 'deepseek', model: 'deepseek-flash', thinking_enabled: false,
      max_output_tokens: 4096, context_budget_tokens: 8192, enabled: true, revision: 1,
      has_api_key: true, credential_available: true, updated_at: '' },
  }
  const chat: AgentChat = {
    chat_id: 'first', title: '当前会话', revision: 1, updated_at: '', current_run_id: run.run_id,
    messages: [
      { message_id: 'old', message_seq: 1, run_id: 'old-run', role: 'assistant', text: '历史回答', reasoning: '', status: 'completed' },
      { message_id: 'question', message_seq: 2, run_id: run.run_id, role: 'user', text: '本轮问题', reasoning: '', status: 'completed' },
      { message_id: 'reply', message_seq: 3, run_id: run.run_id, role: 'assistant', text: '', reasoning: '', status: 'running' },
    ],
  }
  store.chats.second = { chat_id: 'second', title: '另一个会话', revision: 1, updated_at: '' }
  // 用内存流逐帧模拟服务端事件，不依赖模型和网络。
  const stream = new TransformStream<Uint8Array>()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()
  let sequence = 0 // 运行内单调递增的事件游标。
  /** type 和 payload 按真实 SSE 协议发送，供订阅更新助手消息。 */
  async function publish(type: AgentEvent['type'], payload: AgentEvent['payload']) {
    const { instance_id, chat_id, run_id } = run
    const event: AgentEvent = { v: 1, instance_id, chat_id, run_id, seq: ++sequence, type, payload }
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    await flushPromises()
  }
  vi.spyOn(agentChatApi, 'get').mockResolvedValue(chat)
  vi.spyOn(agentChatApi, 'run').mockResolvedValue(run)
  vi.spyOn(agentChatApi, 'events').mockResolvedValue(new Response(stream.readable, { headers: { 'Content-Type': 'text/event-stream' } }))
  vi.spyOn(store, 'restore').mockResolvedValue(undefined)
  const reconnect = vi.spyOn(store, 'reconnect').mockResolvedValue(undefined)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Chat }] })
  await router.push('/')
  await store.select('first')
  const wrapper = mount(Chat, { global: { plugins: [pinia, router, ...antdPlugins], stubs: { SessionSidebar: true } } })
  try {
    const [history, reply] = wrapper.findAll('.agent-message.assistant')
    expect(reply.get('[role="status"]').text()).toBe('正在整理上下文')
    expect(history.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('.agent-feedback').exists()).toBe(false)

    await publish('run.activity', { activity: 'tool_running', tool_name: 'web_search' })
    expect(reply.get('[role="status"]').text()).toBe('正在搜索网页')
    expect(reply.text()).not.toContain('生成中')
    await publish('run.plan', { plan_version: 1, steps: [
      { step_id: 1, kind: 'search', status: 'running' }, { step_id: 2, kind: 'answer', status: 'pending' },
    ] })
    expect(wrapper.findAll('.run-plan')).toHaveLength(1)
    expect(reply.get('.run-plan').text()).toContain('搜索网页')

    store.selected = 'second'
    await nextTick()
    expect(wrapper.find('.reply-progress').exists()).toBe(false)
    store.selected = 'first'
    store.connections[run.run_id] = 'failed'
    await nextTick()
    const currentReply = wrapper.findAll('.agent-message.assistant')[1]
    expect(currentReply.get('[role="status"]').text()).toContain('连接恢复失败')
    await currentReply.get('.reply-progress button').trigger('click')
    expect(reconnect).toHaveBeenCalledWith(run.run_id)

    store.connections[run.run_id] = 'connected'
    const plan = currentReply.get<HTMLDetailsElement>('.run-plan')
    plan.element.open = true
    await publish('answer.delta', { text: '本轮回答' })
    await publish('generation.completed', { status: 'completed', persistence_status: 'saving' })
    expect(currentReply.get('[role="status"]').text()).toBe('正在保存本轮记录')
    await publish('persistence.saved', { persistence_status: 'saved' })
    expect(currentReply.find('.reply-progress').exists()).toBe(false)
    expect(wrapper.find('.agent-feedback').exists()).toBe(false)
    expect(currentReply.text()).toContain('本轮回答')
    expect(currentReply.get('.message-state').text()).toBe('已完成')
    expect(currentReply.get<HTMLDetailsElement>('.run-plan').element.open).toBe(true)
  } finally {
    wrapper.unmount()
    await writer.close().catch(() => undefined)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
