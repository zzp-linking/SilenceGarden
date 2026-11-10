import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { antdPlugins, installAntdEnvironment } from '@/testsupport/antd'
import SearchCredentialEditor from './SearchCredentialEditor.vue'

/** 使用真实 Ant Design 表单验证写入动作、回显边界和保存后清空。 */
it('SearchApi 密钥只在管理员主动提交时发送', async () => {
  installAntdEnvironment()
  const config = { name: 'web_search', label: '网页搜索', enabled: false, ready: false, revision: 1 }
  const save = vi.fn(async () => true)
  const wrapper = mount(SearchCredentialEditor, { props: { config, busy: false, save }, global: { plugins: antdPlugins } })
  try {
    const input = wrapper.get<HTMLInputElement>('input[type=password]')
    expect(input.element.value).toBe('')
    expect(wrapper.text()).toContain('尚未配置密钥')
    await input.setValue('synthetic-admin-key')
    expect(save).not.toHaveBeenCalled()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('synthetic-admin-key')
    expect(input.element.value).toBe('')
    await wrapper.setProps({ config: { ...config, has_api_key: true, credential_available: true, revision: 2 } })
    expect(wrapper.text()).toContain('密钥已配置')
    expect(input.element.value).toBe('')
  } finally {
    wrapper.unmount()
  }
})
