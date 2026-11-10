import { Select } from 'ant-design-vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { agentAdminApi } from '@/api/agentAdmin'
import { antdPlugins, installAntdEnvironment } from '@/testsupport/antd'
import KnowledgeScopeEditor from './KnowledgeScopeEditor.vue'

vi.mock('@/api/agentAdmin', () => ({ agentAdminApi: { bases: vi.fn() } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** 用真实表单提交，防止遗漏表单模型导致点击保存不触发。 */
it('可提交两个指定知识库，并显式保存全部范围', async () => {
  installAntdEnvironment()
  const ids = ['01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000002']
  const timestamp = '2026-11-09T00:00:00Z'
  vi.mocked(agentAdminApi.bases).mockResolvedValue({
    items: ids.map((id, i) => ({ id, name: `验收库${i + 1}`, description: '', revision: 1, created_at: timestamp, updated_at: timestamp }))
  })
  const wrapper = mount(KnowledgeScopeEditor, {
    props: { scope: { mode: 'selected', knowledge_base_ids: [] }, busy: false, saving: false },
    global: { plugins: antdPlugins }
  })
  try {
    await flushPromises()
    wrapper.findComponent(Select).vm.$emit('update:value', [...ids].reverse())
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('save')).toEqual([[{ mode: 'selected', knowledge_base_ids: ids }]]))
    await wrapper.setProps({ scope: { mode: 'selected', knowledge_base_ids: ids } })
    await wrapper.get('input[type=radio][value=all]').setValue(true)
    expect(wrapper.text()).toContain('现有及新增知识库')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('save')?.[1]).toEqual([{ mode: 'all', knowledge_base_ids: [] }]))
  } finally {
    wrapper.unmount()
  }
})
