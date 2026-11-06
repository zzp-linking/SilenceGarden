import { defineComponent } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { Input, Select } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentAdminApi, type KnowledgeDocument } from '@/api/agentAdmin'
import { useKnowledgeUploadStore } from '@/stores/knowledgeUpload'
import { antdPlugins, installAntdEnvironment } from '@/testsupport/antd'
import DocumentEditor from './DocumentEditor.vue'

vi.mock('@/api/agentAdmin', () => ({ agentAdminApi: { upload: vi.fn(), saveDocument: vi.fn() } }))
const wrappers: VueWrapper[] = []
const bookPicker = defineComponent({
  props: ['modelValue', 'disabled', 'baseId'], emits: ['update:modelValue'],
  template: '<select aria-label="Book 归属" :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="none">独立文档</option><option value="book-a">Book A</option></select>'
})
const savedDocument: KnowledgeDocument = { id: 'document-a', knowledge_base_id: 'base-a', book_id: null, title: 'Vue', tags: [], revision: 1, source: { id: 'asset-a', original_name: 'Vue.md', media_type: 'text/markdown', byte_size: 10, sha256: 'a'.repeat(64) }, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z' }

// Keep the actual Ant Upload/Dragger, Form, Input, Select and submit button.
// Only the modal shell and unrelated paginated Book API are replaced.
function editor(pinia: Pinia = createPinia(), existing: KnowledgeDocument | null = null, baseId = 'base-a') {
  const wrapper = mount(DocumentEditor, { props: { baseId, existing }, global: {
    plugins: [pinia, ...antdPlugins], stubs: { AModal: { template: '<section><slot /></section>' }, BookPicker: bookPicker }
  } })
  wrappers.push(wrapper)
  return wrapper
}
async function selectFile(wrapper: VueWrapper, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
  await flushPromises()
}
beforeEach(() => { installAntdEnvironment(); vi.mocked(agentAdminApi.upload).mockResolvedValue(savedDocument); vi.mocked(agentAdminApi.saveDocument).mockResolvedValue(savedDocument) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('document manual drag upload', () => {
  it('accepts a real drop without auto-upload and restores the successful metadata next time', async () => {
    const pinia = createPinia()
    const wrapper = editor(pinia)
    const request = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const file = new File(['# Vue guide'], 'Vue.md', { type: 'text/markdown' })
    await wrapper.get('.ant-upload-btn').trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()
    expect(wrapper.findAll('.ant-upload-list-item')).toHaveLength(1)
    expect(wrapper.findComponent(Input).props('value')).toBe('Vue')
    expect(agentAdminApi.upload).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
    wrapper.findComponent(Select).vm.$emit('update:value', [' Vue ', 'vue', 'webpack'])
    await wrapper.get('select[aria-label="Book 归属"]').setValue('book-a')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    expect(agentAdminApi.upload).toHaveBeenCalledWith('base-a', { title: 'Vue', tags: ['vue', 'webpack'], book_id: 'book-a' }, file)
    const next = editor(pinia)
    expect(next.findComponent(Select).props('value')).toEqual(['vue', 'webpack'])
    expect((next.get('select').element as HTMLSelectElement).value).toBe('book-a')
    expect(next.findComponent(Input).props('value')).toBe('')
    expect(next.findAll('.ant-upload-list-item')).toHaveLength(0)
    const other = editor(pinia, null, 'base-b')
    expect(other.findComponent(Select).props('value')).toEqual([])
    expect((other.get('select').element as HTMLSelectElement).value).toBe('none')
  })

  it('replaces/removes the selected file, preserves a custom title and rejects unsupported/empty input', async () => {
    const wrapper = editor()
    await selectFile(wrapper, new File(['one'], 'one.md'))
    await selectFile(wrapper, new File(['two'], 'two.txt'))
    expect(wrapper.findAll('.ant-upload-list-item')).toHaveLength(1)
    expect(wrapper.findComponent(Input).props('value')).toBe('two')
    await wrapper.findComponent(Input).get('input').setValue('手动标题')
    await selectFile(wrapper, new File(['three'], 'three.docx'))
    expect(wrapper.findComponent(Input).props('value')).toBe('手动标题')
    await wrapper.get('.ant-upload-list-item button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.ant-upload-list-item')).toHaveLength(0)
    await selectFile(wrapper, new File(['code'], 'program.exe'))
    expect(wrapper.text()).toContain('仅支持 TXT、MD、PDF、DOCX 原文件')
    await selectFile(wrapper, new File([], 'empty.md'))
    expect(wrapper.text()).toContain('文件内容为空')
    expect(agentAdminApi.upload).not.toHaveBeenCalled()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('请选择原文件'))
    expect(agentAdminApi.upload).not.toHaveBeenCalled()
  })

  it('does not replace remembered settings on uncertain upload failure or metadata edits', async () => {
    const pinia = createPinia()
    const store = useKnowledgeUploadStore(pinia)
    store.remember('base-a', { tags: ['remembered'], book_id: 'book-a' })
    const wrapper = editor(pinia)
    await selectFile(wrapper, new File(['source'], 'source.md'))
    wrapper.findComponent(Select).vm.$emit('update:value', ['unsaved'])
    vi.mocked(agentAdminApi.upload).mockRejectedValueOnce(new Error('上传结果不确定'))
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('上传结果不确定'))
    expect(wrapper.get('.ant-upload-drag').classes()).toContain('ant-upload-disabled')
    await selectFile(wrapper, new File(['ignored'], 'ignored.md'))
    expect(wrapper.get('.ant-upload-list').text()).toContain('source.md')
    expect(wrapper.get('.ant-upload-list').text()).not.toContain('ignored.md')
    await wrapper.get('form').trigger('submit')
    expect(agentAdminApi.upload).toHaveBeenCalledTimes(1)
    expect(store.defaultsFor('base-a')).toEqual({ tags: ['remembered'], book_id: 'book-a' })
    const edit = editor(pinia, { ...savedDocument, tags: ['existing'], book_id: null })
    expect(edit.find('input[type="file"]').exists()).toBe(false)
    expect(edit.findComponent(Select).props('value')).toEqual(['existing'])
    await edit.get('form').trigger('submit')
    await vi.waitFor(() => expect(edit.emitted('saved')).toHaveLength(1))
    expect(store.defaultsFor('base-a')).toEqual({ tags: ['remembered'], book_id: 'book-a' })
  })
})
