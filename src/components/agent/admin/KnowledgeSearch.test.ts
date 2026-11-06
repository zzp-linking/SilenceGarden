import { mount } from '@vue/test-utils'
import { Form, Button, Input } from 'ant-design-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentIndexAdminApi } from '@/api/agentIndexAdmin'
import KnowledgeSearch from './KnowledgeSearch.vue'

vi.mock('@/api/agentIndexAdmin', () => ({ agentIndexAdminApi: { search: vi.fn() } }))
const id = '01900000-0000-7000-8000-000000000001'
const box = { template: '<div><slot /></div>' }

/** Use the actual Ant Design Form/submit button. A finish-emitting stub would
 * conceal a missing :model binding and pass while the browser button did nothing. */
function searchForm() {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  return mount(KnowledgeSearch, { props: { baseId: id, ready: true, refreshKey: 0 }, global: {
    components: { AForm: Form, AFormItem: Form.Item, AButton: Button, ATextarea: Input.TextArea },
    stubs: { ACard: box, ASpace: box, ATag: box, AAlert: { props: ['message'], template: '<div role="alert">{{ message }}</div>' }, AInput: true, AInputNumber: true, BookPicker: true }
  } })
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('real knowledge search submission', () => {
  it('submits a native form and displays a legitimate zero match result', async () => {
    vi.mocked(agentIndexAdminApi.search).mockResolvedValue({ status: 'no_matches', profile_id: id, space_id: id, hits: [] })
    const wrapper = searchForm()
    await wrapper.get('textarea').setValue('ref 和 computed')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(agentIndexAdminApi.search).toHaveBeenCalledTimes(1))
    expect(agentIndexAdminApi.search).toHaveBeenCalledWith(id, { query: 'ref 和 computed', book: 'all', title: '', tag: '', top_k: 8 }, expect.any(AbortSignal))
    await vi.waitFor(() => expect(wrapper.text()).toContain('没有符合当前范围与过滤条件的生效片段'))
    wrapper.unmount()
  })
  it('invalidates a response after the KB changes and distinguishes an HTTP failure', async () => {
    let resolve!: (value: { status: 'no_matches'; profile_id: string; space_id: string; hits: [] }) => void
    vi.mocked(agentIndexAdminApi.search).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const wrapper = searchForm()
    await wrapper.get('textarea').setValue('旧库查询')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(agentIndexAdminApi.search).toHaveBeenCalledTimes(1))
    await wrapper.setProps({ baseId: '01900000-0000-7000-8000-000000000002' })
    resolve({ status: 'no_matches', profile_id: id, space_id: id, hits: [] })
    await Promise.resolve()
    expect(wrapper.text()).not.toContain('没有符合当前范围')
    vi.mocked(agentIndexAdminApi.search).mockRejectedValueOnce(new Error('运行配置已失效'))
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('运行配置已失效'))
    expect(wrapper.text()).not.toContain('没有符合当前范围')
    wrapper.unmount()
  })
})
