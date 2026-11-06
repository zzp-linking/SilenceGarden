import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { antdPlugins, installAntdEnvironment } from '@/testsupport/antd'
beforeEach(installAntdEnvironment)
import CollectionOrderList from './CollectionOrderList.vue'
import ArticleCatalogList from './ArticleCatalogList.vue'

const RouterLink = defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' })
describe('article catalog and book order', () => {
  it('links books to book catalogs and standalone articles to their unchanged URLs', () => {
    const wrapper = mount(ArticleCatalogList, { props: { items: [
      { _id: 'article-a', title: '文章', tags: [] },
      { type: 'collection', _id: 'book-a', title: '书', tags: [], articleCount: 80 }
    ] }, global: { plugins: antdPlugins, stubs: { RouterLink } } })
    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['/article/article-a', '/article/collection/book-a'])
    expect(wrapper.text()).toContain('80 篇文章')
    wrapper.unmount()
  })
  it('offers a keyboard-capable reorder and emits only the new ID order', async () => {
    const items = [{ _id: 'a', title: 'A', tags: [] }, { _id: 'b', title: 'B', tags: [] }, { _id: 'c', title: 'C', tags: [] }]
    const wrapper = mount(CollectionOrderList, { props: { items }, global: { plugins: antdPlugins, stubs: { RouterLink } } })
    await wrapper.get('button[aria-label="下移 A"]').trigger('click')
    await wrapper.get('button[aria-label="下移 A"]').trigger('click')
    expect(items.map(item => item._id)).toEqual(['a', 'b', 'c'])
    await wrapper.findAll('button').find(button => button.text() === '保存目录顺序')!.trigger('click')
    expect(wrapper.emitted('save')?.[0]).toEqual([['b', 'c', 'a']])
    await wrapper.setProps({ items: [items[1]!, items[2]!, items[0]!] })
    expect(wrapper.findAll('button').find(button => button.text() === '保存目录顺序')!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('preserves drag ordering and prevents changes when the panel is locked', async () => {
    const items = [{ _id: 'a', title: 'A', tags: [] }, { _id: 'b', title: 'B', tags: [] }]
    const wrapper = mount(CollectionOrderList, { props: { items }, global: { plugins: antdPlugins, stubs: { RouterLink } } })
    const rows = wrapper.findAll('tbody tr[draggable]')
    await rows[0]!.trigger('dragstart')
    await rows[1]!.trigger('drop')
    await wrapper.findAll('button').find(button => button.text() === '保存目录顺序')!.trigger('click')
    expect(wrapper.emitted('save')?.[0]).toEqual([['b', 'a']])
    expect(wrapper.emitted('dirty')?.at(-1)).toEqual([true])
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('button[aria-label="下移 B"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('tbody tr[draggable]')[0]!.attributes('draggable')).toBe('false')
    wrapper.unmount()
  })
})

