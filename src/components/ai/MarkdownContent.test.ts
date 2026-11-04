import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownContent from './MarkdownContent.vue'

describe('MarkdownContent remote image policy', () => {
  it('renders a normal remote image as a click-only link', () => {
    const wrapper = mount(MarkdownContent, { props: { source: '![图](https://example.invalid/image.png)' } })
    const link = wrapper.get('a[href="https://example.invalid/image.png"]')
    expect(link.text()).toBe('查看远程图片：图')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it.each([
    ['![<img src="https://example.invalid/pixel">](https://example.invalid/view)', '<img'],
    ['![<svg onload="alert(1)">](https://example.invalid/view)', '<svg'],
    ['![&lt;img src="https://example.invalid/pixel"&gt;](https://example.invalid/view)', '&lt;img'],
    ['![" onclick="alert(1)](https://example.invalid/view)', '" onclick']
  ])('keeps untrusted alt as text: %s', (source, expectedText) => {
    const wrapper = mount(MarkdownContent, { props: { source } })
    const link = wrapper.get('a[href="https://example.invalid/view"]')
    expect(link.text()).toContain(expectedText)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(link.attributes('onclick')).toBeUndefined()
    expect(link.attributes('onload')).toBeUndefined()
  })

  it('does not create a remote image or a dangerous link from unsafe markup', () => {
    const wrapper = mount(MarkdownContent, { props: { source: '![图](javascript:alert(1)) <img src="https://example.invalid/pixel">' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false)
  })

  it('does not turn quotes in an image URL into HTML attributes', () => {
    const wrapper = mount(MarkdownContent, { props: { source: '![图](<https://example.invalid/view"onclick="alert(1)>)' } })
    const link = wrapper.get('a')
    expect(link.attributes('href')).toContain('https://example.invalid/view')
    expect(link.attributes('onclick')).toBeUndefined()
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
