<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { alert } from '@mdit/plugin-alert'
import { footnote } from '@mdit/plugin-footnote'
import { katex } from '@mdit/plugin-katex'
import { tasklist } from '@mdit/plugin-tasklist'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import { computed, getCurrentInstance } from 'vue'
import MermaidBlock from './MermaidBlock.vue'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'

const props = defineProps<{ source: string; maxChars?: number }>()
const emit = defineEmits<{ 'copy-code': [code: string] }>()

const safeLink = (url: string): boolean => /^(https?:|mailto:)/i.test(url)
const alertLabels: Record<string, string> = {
  note: '说明',
  tip: '提示',
  important: '重要',
  warning: '注意',
  caution: '警告'
}
const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false }).use(katex, {
  // 兼容模型常见的 $...$ / $$...$$ 与 LaTeX 的 \(...\) / \[...\]。
  delimiters: 'all',
  // 流式输出中公式可能暂时不完整，保留源码而不是让整条消息渲染失败。
  throwOnError: false,
  // 禁止 \href、\includegraphics、\htmlStyle 等生成不受控 HTML 的命令。
  trust: false,
  output: 'htmlAndMathml',
  maxSize: 20,
  maxExpand: 1000
}).use(alert, {
  titleRenderer: (tokens, index) => {
    const name = tokens[index]?.markup.toLowerCase() ?? 'note'
    return `<p class="markdown-alert-title">${alertLabels[name] ?? alertLabels.note}</p>\n`
  }
}).use(tasklist, {
  disabled: true,
  label: false
}).use(footnote)

// 脚注锚点必须在同一页面的多条消息间保持唯一。
const documentId = `md-${getCurrentInstance()?.uid ?? 'content'}`

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
markdown.renderer.rules.checkbox_input = (tokens, index, options, env, self) => {
  const token = tokens[index]
  if (!token) return ''
  token.attrs = token.attrs?.filter(([name]) => name !== 'id') ?? null
  token.attrSet('aria-label', token.attrGet('checked') ? '已完成' : '未完成')
  return self.renderToken(tokens, index, options)
}

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

type ContentSegment =
  | { key: string; kind: 'html'; html: string }
  | { key: string; kind: 'mermaid'; source: string }

function sanitizeHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    // KaTeX 默认同时生成可视 HTML 和用于无障碍阅读的 MathML。
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: ['style', 'iframe', 'form', 'svg'],
    // KaTeX 的定位依赖受控的内联 style；原始 Markdown HTML 已由 html: false 转义。
    FORBID_ATTR: ['onerror', 'onclick', 'onload'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i
  })
}

function isClosedFence(token: { map: [number, number] | null; markup: string }, lines: string[]): boolean {
  if (!token.map || !token.markup) return false
  const closingLine = lines[token.map[1] - 1]?.trim() ?? ''
  const marker = token.markup[0]
  if (marker !== '`' && marker !== '~') return false
  const markerLength = [...closingLine].findIndex(character => character !== marker)
  const actualLength = markerLength < 0 ? closingLine.length : markerLength
  return actualLength >= token.markup.length && closingLine.slice(actualLength).trim() === ''
}

const rendered = computed<ContentSegment[]>(() => {
  const source = props.source.slice(0, props.maxChars ?? 100_000)
  const environment = { docId: documentId }
  const tokens = markdown.parse(source, environment)
  const lines = source.split(/\r?\n/)
  const segments: ContentSegment[] = []
  let htmlTokens: typeof tokens = []
  let segmentIndex = 0

  const flushHtml = (): void => {
    if (!htmlTokens.length) return
    const html = markdown.renderer.render(htmlTokens, markdown.options, environment)
    segments.push({ key: `html-${segmentIndex++}`, kind: 'html', html: sanitizeHtml(html) })
    htmlTokens = []
  }

  for (const token of tokens) {
    const language = token.type === 'fence' ? token.info.trim().split(/\s+/)[0]?.toLowerCase() : ''
    if (token.level === 0 && language === 'mermaid' && isClosedFence(token as { map: [number, number] | null; markup: string }, lines)) {
      flushHtml()
      segments.push({ key: `mermaid-${segmentIndex++}`, kind: 'mermaid', source: token.content })
    } else {
      htmlTokens.push(token)
    }
  }
  flushHtml()
  return segments
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
  <div class="markdown-content" @click="onContentClick">
    <template v-for="segment in rendered" :key="segment.key">
      <div v-if="segment.kind === 'html'" class="markdown-segment" v-html="segment.html"></div>
      <MermaidBlock v-else :source="segment.source" />
    </template>
  </div>
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
.markdown-content :deep(.task-list-container) {
  padding-left: 0.25em;
  list-style: none;
}
.markdown-content :deep(.task-list-item) {
  list-style: none;
}
.markdown-content :deep(.task-list-item-checkbox) {
  width: 15px;
  height: 15px;
  margin: 0 0.55em 0 0;
  accent-color: var(--whisper-blue-deep);
  vertical-align: -2px;
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
.markdown-content :deep(.markdown-alert) {
  --alert-accent: var(--whisper-blue);
  margin: 0.9em 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--alert-accent) 24%, transparent);
  border-left: 4px solid var(--alert-accent);
  border-radius: var(--whisper-radius-sm);
  background: color-mix(in srgb, var(--alert-accent) 7%, var(--whisper-surface));
  color: var(--whisper-ink-soft);
}
.markdown-content :deep(.markdown-alert-note) {
  --alert-accent: var(--whisper-blue);
}
.markdown-content :deep(.markdown-alert-tip) {
  --alert-accent: var(--whisper-focus);
}
.markdown-content :deep(.markdown-alert-important) {
  --alert-accent: var(--whisper-violet);
}
.markdown-content :deep(.markdown-alert-warning) {
  --alert-accent: var(--whisper-seal);
}
.markdown-content :deep(.markdown-alert-caution) {
  --alert-accent: var(--whisper-danger);
}
.markdown-content :deep(.markdown-alert-title) {
  margin: 0 0 0.25em;
  color: var(--alert-accent);
  font-size: 0.84em;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.markdown-content :deep(.markdown-alert > :last-child) {
  margin-bottom: 0;
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
.markdown-content :deep(.footnotes-sep) {
  margin: 1.6em 0 0.8em;
  border: 0;
  border-top: 1px solid var(--whisper-line);
}
.markdown-content :deep(.footnotes) {
  color: var(--whisper-ink-faint);
  font-size: 0.86em;
}
.markdown-content :deep(.footnotes-list) {
  margin: 0;
}
.markdown-content :deep(.footnote-ref a),
.markdown-content :deep(.footnote-backref) {
  text-decoration: none;
}
.markdown-content :deep(.footnote-ref a:focus-visible),
.markdown-content :deep(.footnote-backref:focus-visible) {
  border-radius: 3px;
  outline: 2px solid var(--whisper-focus);
  outline-offset: 2px;
}
.markdown-content :deep(.katex) {
  font-size: 1.05em;
}
.markdown-content :deep(.katex-display) {
  max-width: 100%;
  margin: 0.85em 0;
  padding: 0.2em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
