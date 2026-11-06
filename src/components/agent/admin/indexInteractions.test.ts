import { defineComponent } from 'vue'
import { createPinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeDocument } from '@/api/agentAdmin'
import { agentAdminApi } from '@/api/agentAdmin'
import { agentIndexAdminApi } from '@/api/agentIndexAdmin'
import DocumentEditor from './DocumentEditor.vue'
import DocumentIndexActions from './DocumentIndexActions.vue'
import DocumentPanel from './DocumentPanel.vue'
import BookPicker from './BookPicker.vue'

vi.mock('@/api/agentAdmin', () => ({ agentAdminApi: { saveDocument: vi.fn(), upload: vi.fn(), documents: vi.fn() } }))
vi.mock('@/api/agentIndexAdmin', () => ({ agentIndexAdminApi: { document: vi.fn(), clear: vi.fn() } }))
const id = '01900000-0000-7000-8000-000000000001'
const stamp = '2026-11-05T00:00:00Z'
const document: KnowledgeDocument = { id, knowledge_base_id: id, book_id: id, title: '标题', tags: ['vue'], revision: 2, source: { id, original_name: 'source.md', media_type: 'text/markdown', byte_size: 20, sha256: 'a'.repeat(64) }, created_at: stamp, updated_at: stamp, index: { index_revision: 1, active_version_id: null, profile_id: null, chunk_count: 0, busy: true, item: { id, document_id: id, state: 'queued', phase: 'queued', index_version_id: null, completed_chunks: 0, total_chunks: 0, created_at: stamp, updated_at: stamp } } }
const container = { template: '<div><slot /></div>' }
const button = defineComponent({ props: { disabled: Boolean }, template: '<button :disabled="disabled"><slot /></button>' })
const input = defineComponent({ props: { disabled: Boolean }, template: '<input :disabled="disabled" />' })
const stubs = { AModal: container, AAlert: container, ASpace: container, AFormItem: container, AInput: input, ASelect: input, AButton: button, AForm: { emits: ['finish'], template: '<form @submit.prevent="$emit(\'finish\')"><slot /></form>' } }

describe('index busy UI boundaries', () => {
  it.each(['queued', 'running'] as const)('hides the previous failure while %s and follows the latest result after refresh', async state => {
    /** previous：上一次失败记录；新任务在途时，接口仍会保留这份历史事实。 */
    const previous = { ...document.index!.item!, state: 'failed' as const, error_code: 'INDEX_BUILD_FAILED', error_message: '索引构建未完成，可查看服务诊断后手动重试' }
    /** current：本次重建的真实状态，与历史失败记录相互独立。 */
    const current = { ...document.index!.item!, id: '01900000-0000-7000-8000-000000000002', state }
    /** pending：复现旧失败与当前排队或执行中的条目同时返回的列表快照。 */
    const pending: KnowledgeDocument = { ...document, index: { ...document.index!, item: current, recent_terminal: previous } }
    vi.mocked(agentAdminApi.documents).mockResolvedValue({ items: [pending] })
    /** table：渲染文档单元格，保留生产组件的状态推导与失败提示逻辑。 */
    const table = defineComponent({ props: ['dataSource'], template: '<div><div v-for="record in dataSource" :key="record.id"><slot name="bodyCell" :column="{ key: \'document\' }" :record="record" /></div></div>' })
    /** wrapper：通过实际列表加载和刷新，校验历史错误不会覆盖当前任务的展示。 */
    const wrapper = shallowMount(DocumentPanel, { props: { baseId: id, refreshKey: 0, activityKey: 0 }, global: { stubs: { ...stubs, ACard: container, ATag: container, ATable: table, APopconfirm: container } } })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('首次索引排队 / 执行中')
      expect(wrapper.find('.index-failure').exists()).toBe(false)

      // 本次真正失败后仍应显示错误，不能为了隐藏历史记录而吞掉新的失败。
      const failed = { ...current, state: 'failed' as const, error_message: '本次构建失败' }
      vi.mocked(agentAdminApi.documents).mockResolvedValue({ items: [{ ...pending, index: { ...pending.index!, busy: false, item: failed, recent_terminal: failed } }] })
      await wrapper.setProps({ activityKey: 1 })
      await flushPromises()
      expect(wrapper.get('.index-failure').text()).toContain('本次构建失败')

      // 后续重试成功后，最近终态更新为成功，列表不应继续残留失败提示。
      const succeeded = { ...current, state: 'succeeded' as const, phase: 'completed', completed_chunks: 27, total_chunks: 27 }
      vi.mocked(agentAdminApi.documents).mockResolvedValue({ items: [{ ...pending, index: { ...pending.index!, busy: false, active_version_id: current.id, chunk_count: 27, item: succeeded, recent_terminal: succeeded } }] })
      await wrapper.setProps({ activityKey: 2 })
      await flushPromises()
      expect(wrapper.find('.index-failure').exists()).toBe(false)
      expect(wrapper.text()).toContain('27 片段')
    } finally { wrapper.unmount() }
  })
  it('locks Book affiliation while preserving title/tag maintenance and metadata CAS', async () => {
    vi.mocked(agentAdminApi.saveDocument).mockResolvedValue(document)
    const wrapper = shallowMount(DocumentEditor, { props: { baseId: id, existing: document }, global: { plugins: [createPinia()], stubs } })
    expect(wrapper.findComponent(BookPicker).props('disabled')).toBe(true)
    expect(wrapper.findAll('input').every(field => !(field.element as HTMLInputElement).disabled)).toBe(true)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    expect(agentAdminApi.saveDocument).toHaveBeenCalledWith(document, { title: '标题', tags: ['vue'], book_id: id })
    wrapper.unmount()
  })
  it('blocks build/force/clear even if a stale confirmation is emitted during busy', async () => {
    const popconfirm = defineComponent({ emits: ['confirm'], template: '<div><slot /></div>' })
    const wrapper = shallowMount(DocumentIndexActions, { props: { document, accepting: true }, global: { stubs: { ...stubs, APopconfirm: popconfirm } } })
    const build = wrapper.findAll('button').find(item => item.text() === '建立索引')!
    expect((build.element as HTMLButtonElement).disabled).toBe(true)
    wrapper.findAllComponents(popconfirm).forEach(item => item.vm.$emit('confirm'))
    await Promise.resolve()
    expect(agentIndexAdminApi.document).not.toHaveBeenCalled()
    expect(agentIndexAdminApi.clear).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
