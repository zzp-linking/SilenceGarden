<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import { computed } from 'vue'
import 'highlight.js/styles/github.css'

const props = defineProps<{ source: string; maxChars?: number }>()
const emit = defineEmits<{ 'copy-code': [code: string] }>()

const safeLink = (url: string): boolean => /^(https?:|mailto:)/i.test(url)
const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false })

function renderCode(code: string, language: string): string {
  const highlighted = language && hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : markdown.utils.escapeHtml(code)
  return `<div class="code-block"><div class="code-head"><span class="code-lang">${markdown.utils.escapeHtml(language || 'text')}</span><button type="button" class="code-copy" data-code="${encodeURIComponent(code)}">复制</button></div><pre><code class="hljs${language ? ` language-${markdown.utils.escapeHtml(language)}` : ''}">${highlighted}</code></pre></div>`
}
// 代码块：语言标记 + 复制按钮 + 横向滚动（产品设计文档 §8.4）
markdown.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]
  return renderCode(token?.content ?? '', (token?.info ?? '').trim().split(/\s+/)[0] ?? '')
}
markdown.renderer.rules.code_block = (tokens, index) => renderCode(tokens[index]?.content ?? '', '')

const defaultLinkOpen = markdown.renderer.rules.link_open
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = tokens[index]?.attrGet('href') ?? ''
  if (!safeLink(String(href))) return ''
  tokens[index]?.attrSet('target', '_blank')
  tokens[index]?.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen ? defaultLinkOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
}
const defaultImage = markdown.renderer.rules.image
markdown.renderer.rules.image = (tokens, index) => {
  const token = tokens[index]
  const src = token?.attrGet('src') ?? ''
  const alt = token?.content ?? '远程图片'
  return safeLink(String(src)) ? `<a href="${src}" target="_blank" rel="noopener noreferrer">查看远程图片：${alt}</a>` : `<span>已隐藏不安全图片：${alt}</span>`
}

const rendered = computed(() => {
  const source = props.source.slice(0, props.maxChars ?? 100_000)
  return DOMPurify.sanitize(markdown.render(source), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'form', 'svg', 'math'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i
  })
})

async function onContentClick(event: MouseEvent): Promise<void> {
  const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.code-copy') : null
  if (!button) return
  const code = decodeURIComponent(button.dataset['code'] ?? '')
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    const codeNode = button.closest('.code-block')?.querySelector('code')
    if (codeNode) {
      const range = document.createRange()
      range.selectNodeContents(codeNode)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
  button.textContent = '已复制'
  window.setTimeout(() => { button.textContent = '复制' }, 1200)
  emit('copy-code', code)
}
</script>

<template>
  <div class="markdown-content" @click="onContentClick" v-html="rendered"></div>
</template>

<style scoped>
.markdown-content {
  color: var(--whisper-ink);
  font-size: 15px;
  line-height: 1.85;
  overflow-wrap: anywhere;
}
.markdown-content :deep(p) {
  margin: 0.55em 0;
}
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 1.1em 0 0.5em;
  line-height: 1.4;
}
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.4em;
}
.markdown-content :deep(a) {
  color: var(--whisper-blue-deep);
}
.markdown-content :deep(blockquote) {
  margin: 0.8em 0;
  padding: 2px 14px;
  border-left: 3px solid var(--whisper-mist-deep);
  color: var(--whisper-ink-soft);
}
.markdown-content :deep(:not(pre) > code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--whisper-mist);
  font-size: 0.87em;
}
.markdown-content :deep(.code-block) {
  margin: 12px 0;
  overflow: hidden;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: #f5f6fb;
}
.markdown-content :deep(.code-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px 5px 14px;
  border-bottom: 1px solid var(--whisper-line);
  background: var(--whisper-mist);
}
.markdown-content :deep(.code-lang) {
  color: var(--whisper-ink-faint);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.markdown-content :deep(.code-copy) {
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--whisper-blue-deep);
  font-size: 12px;
  cursor: pointer;
}
.markdown-content :deep(.code-copy:hover) {
  background: var(--whisper-hover);
}
.markdown-content :deep(pre) {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  background: transparent;
}
.markdown-content :deep(pre code) {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}
.markdown-content :deep(table) {
  border-collapse: collapse;
  margin: 12px 0;
}
.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 6px 12px;
  border: 1px solid var(--whisper-line);
}
.markdown-content :deep(th) {
  background: var(--whisper-mist);
}
</style>
