import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArticleStore } from '@/stores/article'
import type { ArticleEditDetail } from '@/types/article'
import Editor from './Editor.vue'
import { ApiError } from '@/utils/net'

vi.mock('@/utils/talk', () => ({ message: vi.fn() }))
vi.mock('mavon-editor', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    mavonEditor: defineComponent({
      name: 'MavonEditor',
      props: { modelValue: String },
      emits: ['update:modelValue', 'change'],
      setup(props, { emit }) {
        return () => h('textarea', {
          class: 'markdown-editor', value: props.modelValue,
          onInput: (event: Event) => {
            const value = (event.target as HTMLTextAreaElement).value
            emit('update:modelValue', value)
            emit('change', value, `<p>${value}</p>`)
          }
        })
      }
    })
  }
})

const FormStub = defineComponent({
  name: 'AForm',
  setup(_props, { slots, expose }) {
    expose({ validate: () => Promise.resolve(), clearValidate: () => undefined })
    return () => h('form', slots.default?.())
  }
})
const InputStub = defineComponent({
  name: 'AInput',
  props: { value: String, placeholder: String },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () => h('input', {
      value: props.value, placeholder: props.placeholder,
      onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
    })
  }
})
const ButtonStub = defineComponent({
  name: 'AButton',
  props: { disabled: Boolean },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () => h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
  }
})
const SlotStub = defineComponent({
  setup(_props, { slots }) { return () => h('div', slots.default?.()) }
})

const CollectionSelectorStub = defineComponent({
  name: 'ArticleCollectionSelector',
  props: { modelValue: String, disabled: Boolean },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('select', { class: 'collection-choice', value: props.modelValue || '', disabled: props.disabled,
      onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value || null)
    }, [h('option', { value: '' }, '独立文章'), h('option', { value: '670000000000000000000001' }, '合集 A'), h('option', { value: '670000000000000000000002' }, '合集 B')])
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

async function setupEditor(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useArticleStore()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/editor/:id?', component: Editor },
      { path: '/article', component: { template: '<div>catalog</div>' } },
      { path: '/article/collection/:id', component: { template: '<div>collection</div>' } },
      { path: '/other', component: { template: '<div>other</div>' } }
    ]
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(Editor, {
    global: {
      plugins: [pinia, router],
      stubs: { AForm: FormStub, AFormItem: SlotStub, AInput: InputStub, AButton: ButtonStub, ASpace: SlotStub, ATag: SlotStub, UserOutlined: true, ArticleCollectionSelector: CollectionSelectorStub }
    }
  })
  await flushPromises()
  return { wrapper, store, router }
}

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })

describe('Editor route decides save target', () => {
  it('clears article A before creating B and sends an explicit create target', async () => {
    const original = { title: '文章 A', tags: ['旧标签'], markdown: '旧正文' }
    const { wrapper, store, router } = await setupEditor('/editor')
    const load = vi.spyOn(store, 'getReviseArticleDetails').mockResolvedValue(original)
    const save = vi.spyOn(store, 'articleSave').mockResolvedValue()
    await router.push('/editor/article-a')
    await flushPromises()
    expect(load).toHaveBeenCalledWith({ id: 'article-a' }, expect.any(AbortSignal))
    expect(wrapper.get('input[placeholder="Title"]').element).toHaveProperty('value', '文章 A')

    await router.push('/editor')
    await flushPromises()
    expect(wrapper.get('input[placeholder="Title"]').element).toHaveProperty('value', '')
    expect(wrapper.text()).toContain('新建文章')
    await wrapper.get('input[placeholder="Title"]').setValue('文章 B')
    await wrapper.get('.markdown-editor').setValue('新正文')
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: '文章 B', tags: [], markdown: '新正文', html: '<p>新正文</p>', collectionId: null, requestId: expect.any(String) }),
      { mode: 'create' }
    )
    expect(router.currentRoute.value.path).toBe('/article')
  })

  it('ignores a late load for article A after navigating to article B', async () => {
    const lateA = deferred<ArticleEditDetail>()
    const { wrapper, store, router } = await setupEditor('/editor')
    vi.spyOn(store, 'getReviseArticleDetails').mockImplementation(({ id }) => id === 'article-a'
      ? lateA.promise
      : Promise.resolve({ title: '文章 B', tags: [], markdown: 'B 正文' }))

    await router.push('/editor/article-a')
    await nextTick()
    await router.push('/editor/article-b')
    await flushPromises()
    expect(wrapper.get('input[placeholder="Title"]').element).toHaveProperty('value', '文章 B')
    lateA.resolve({ title: '文章 A', tags: [], markdown: 'A 正文' })
    await flushPromises()
    expect(wrapper.get('input[placeholder="Title"]').element).toHaveProperty('value', '文章 B')
  })

  it('submits once and ignores an old save response after navigation', async () => {
    const pending = deferred<void>()
    const { wrapper, store, router } = await setupEditor('/editor')
    const save = vi.spyOn(store, 'articleSave').mockReturnValue(pending.promise)
    vi.spyOn(store, 'getReviseArticleDetails').mockResolvedValue({ title: '文章 B', tags: [], markdown: 'B 正文' })
    await wrapper.get('input[placeholder="Title"]').setValue('新文章')
    const publish = wrapper.findAll('button')[1]!
    await publish.trigger('click')
    await publish.trigger('click')
    expect(save).toHaveBeenCalledTimes(1)

    await router.push('/editor/article-b')
    await flushPromises()
    pending.resolve()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/editor/article-b')
    expect(wrapper.get('input[placeholder="Title"]').element).toHaveProperty('value', '文章 B')
  })

  it('does not navigate back after the editor has unmounted during save', async () => {
    const pending = deferred<void>()
    const { wrapper, store, router } = await setupEditor('/editor')
    vi.spyOn(store, 'articleSave').mockReturnValue(pending.promise)
    const push = vi.spyOn(router, 'push')
    await wrapper.get('input[placeholder="Title"]').setValue('新文章')
    await wrapper.findAll('button')[1]!.trigger('click')
    await router.push('/other')
    wrapper.unmount()
    pending.resolve()
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/other')
    expect(push).not.toHaveBeenCalledWith('/article')
  })
})

it('passes selected and expected book IDs and returns to the selected book after saving', async () => {
  const { wrapper, store, router } = await setupEditor('/editor')
  vi.spyOn(store, 'getReviseArticleDetails').mockResolvedValue({ title: '原文', tags: [], markdown: '正文', collectionId: '670000000000000000000001' })
  const save = vi.spyOn(store, 'articleSave').mockResolvedValue({ state: 'complete', updated: true, matchedCount: 1, collectionId: '670000000000000000000002' })
  await router.push('/editor/article-a')
  await flushPromises()
  await wrapper.get('.collection-choice').setValue('670000000000000000000002')
  await wrapper.findAll('button')[1]!.trigger('click')
  await flushPromises()
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ collectionId: '670000000000000000000002', expectedCollectionId: '670000000000000000000001', requestId: expect.any(String) }), { mode: 'edit', id: 'article-a' })
  expect(router.currentRoute.value.path).toBe('/article/collection/670000000000000000000002')
})

it('refreshes a conflicting membership without replacing the unsaved title or Markdown', async () => {
  const { wrapper, store, router } = await setupEditor('/editor')
  const load = vi.spyOn(store, 'getReviseArticleDetails').mockResolvedValue({ title: '原文', tags: [], markdown: '原正文', collectionId: '670000000000000000000001' })
  const save = vi.spyOn(store, 'articleSave').mockRejectedValueOnce(new ApiError('MEMBERSHIP_CONFLICT', '归属已变化', { state: 'failed' }))
  await router.push('/editor/article-a')
  await flushPromises()
  await wrapper.get('input[placeholder="Title"]').setValue('未保存的新标题')
  await wrapper.get('.markdown-editor').setValue('未保存的新正文')
  await wrapper.findAll('button')[1]!.trigger('click')
  await flushPromises()
  load.mockResolvedValue({ title: '服务器标题', tags: [], markdown: '服务器正文', collectionId: '670000000000000000000002' })
  await wrapper.findAll('button').find(button => button.text() === '刷新所属合集，保留正文')!.trigger('click')
  await flushPromises()
  expect(wrapper.get('input[placeholder="Title"]').element).toHaveProperty('value', '未保存的新标题')
  expect(wrapper.get('.markdown-editor').element).toHaveProperty('value', '未保存的新正文')
  save.mockResolvedValue({ state: 'complete', updated: true, matchedCount: 1, collectionId: '670000000000000000000002' })
  await wrapper.findAll('button')[1]!.trigger('click')
  await flushPromises()
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedCollectionId: '670000000000000000000002', title: '未保存的新标题', markdown: '未保存的新正文' }), { mode: 'edit', id: 'article-a' })
})
