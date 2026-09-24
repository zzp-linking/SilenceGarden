import DOMPurify from 'dompurify'
import type { Mermaid } from 'mermaid'

let diagramSequence = 0
let mermaidLoader: Promise<Mermaid> | undefined

function loadMermaid(): Promise<Mermaid> {
  // Mermaid 体积较大，首次遇到图表时才加载，并在全应用复用初始化 Promise。
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: 50_000,
      theme: 'neutral',
      htmlLabels: false,
      flowchart: { useMaxWidth: true },
      sequence: { useMaxWidth: true }
    })
    return mermaid
  })
  return mermaidLoader
}

function sanitizeSvg(value: string): string {
  // Mermaid 输入来自模型输出；即使 strict 模式已过滤，插入 DOM 前仍做第二层清洗。
  return DOMPurify.sanitize(value, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'a'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|#|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i
  })
}

/** 按需加载 Mermaid，并只返回再次清洗过的非交互 SVG。 */
export async function renderMermaidSvg(source: string): Promise<string> {
  const mermaid = await loadMermaid()
  const result = await mermaid.render(`whisper-mermaid-${++diagramSequence}`, source)
  const safeSvg = sanitizeSvg(result.svg)
  if (!safeSvg.includes('<svg')) throw new Error('Mermaid did not produce an SVG')
  return safeSvg
}
