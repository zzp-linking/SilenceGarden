import { Select } from 'ant-design-vue'
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import type { McpService } from '@/api/agentMcpAdmin'
import { antdPlugins, installAntdEnvironment } from '@/testsupport/antd'
import McpServiceEditor from './McpServiceEditor.vue'

/** 真实表单可单独轮换一个保密参数，提交后立即清空密码框。 */
it('保密参数只写入本次操作，其他参数保留原配置', async () => {
  installAntdEnvironment()
  const service: McpService = {
    id: 'fixture', service_key: 'test_map', display_name: '测试地图', endpoint: 'https://example.com/mcp',
    transport: 'streamable_http', auth_mode: 'query', timeout_ms: 10000, enabled: false,
    revision: 3, connection_revision: 1, discovered_connection_revision: 1, has_credential: false,
    query_params: [
      { name: 'locale', value: 'zh-CN' },
      { name: 'ak', secret: true, has_credential: true },
      { name: 'secondary', secret: true, has_credential: true }
    ]
  }
  const wrapper = mount(McpServiceEditor, { props: { service, busy: false }, global: { plugins: antdPlugins } })
  try {
    expect(wrapper.find('input[type=password]').exists()).toBe(false)
    expect(wrapper.text()).toContain('已保存凭据')
    wrapper.findAllComponents(Select)[1].vm.$emit('update:value', 'replace')
    await flushPromises()
    const input = wrapper.get<HTMLInputElement>('input[type=password]')
    expect(input.element.value).toBe('')
    await input.setValue('synthetic-replacement-key')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('save')).toHaveLength(1))
    const [payload] = wrapper.emitted('save')![0]
    expect(payload).toMatchObject({
      query_params: [
        { name: 'locale', value: 'zh-CN' },
        { name: 'ak', secret: true, credential_action: 'replace', credential: 'synthetic-replacement-key' },
        { name: 'secondary', secret: true, credential_action: 'keep' }
      ]
    })
    expect(JSON.stringify(payload)).not.toContain('has_credential')
    expect(input.element.value).toBe('')
  } finally {
    wrapper.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

/** 勾选保密前输入的值自动移入密码框，取消时不会回填到普通参数。 */
it('切换保密参数保留输入方向并打开密码框', async () => {
  installAntdEnvironment()
  const service: McpService = {
    id: 'fixture', service_key: 'test_map', display_name: '测试地图', endpoint: 'https://example.com/mcp',
    transport: 'streamable_http', auth_mode: 'query', timeout_ms: 10000, enabled: false,
    revision: 1, connection_revision: 1, discovered_connection_revision: 0, has_credential: false,
    query_params: [{ name: 'ak', value: '' }]
  }
  const wrapper = mount(McpServiceEditor, { props: { service, busy: false }, global: { plugins: antdPlugins } })
  try {
    const value = wrapper.get<HTMLInputElement>('input[id^="mcp-query-value"]')
    await value.setValue('synthetic-key-draft')
    const check = wrapper.get<HTMLInputElement>('input[type=checkbox]')
    await check.setValue(true)
    expect(wrapper.get<HTMLInputElement>('input[type=password]').element.value).toBe('synthetic-key-draft')
    expect(wrapper.find('input[id^="mcp-query-value"]').exists()).toBe(false)
    await check.setValue(false)
    expect(wrapper.get<HTMLInputElement>('input[id^="mcp-query-value"]').element.value).toBe('')
    expect(wrapper.find('input[type=password]').exists()).toBe(false)
    await wrapper.setProps({ service: { ...service, query_params: [{ name: 'ak', secret: true, has_credential: false }] } })
    expect(wrapper.get<HTMLInputElement>('input[type=password]').element.value).toBe('')
  } finally {
    wrapper.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
