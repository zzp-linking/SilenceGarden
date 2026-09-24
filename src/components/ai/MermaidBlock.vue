<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { renderMermaidSvg } from '@/utils/mermaid'

const props = defineProps<{ source: string }>()

type RenderState = 'loading' | 'ready' | 'error'

const state = shallowRef<RenderState>('loading')
const svg = shallowRef('')

watch(() => props.source, async (source, _previous, onCleanup) => {
  // Markdown 高频更新时只允许最后一次异步渲染提交，避免旧 SVG 覆盖新源码。
  let cancelled = false
  onCleanup(() => { cancelled = true })
  state.value = 'loading'
  svg.value = ''

  try {
    const safeSvg = await renderMermaidSvg(source)
    if (cancelled) return
    svg.value = safeSvg
    state.value = 'ready'
  } catch {
    if (!cancelled) state.value = 'error'
  }
}, { immediate: true })
</script>

<template>
  <figure class="mermaid-block" :class="`is-${state}`">
    <div v-if="state === 'ready'" class="mermaid-canvas" role="img" aria-label="AI 生成的 Mermaid 图表" v-html="svg"></div>
    <p v-else-if="state === 'loading'" class="mermaid-status" role="status">正在绘制图表…</p>
    <div v-else class="mermaid-fallback">
      <p class="mermaid-status" role="status">图表语法无法解析，已保留源码。</p>
      <pre><code>{{ source }}</code></pre>
    </div>
  </figure>
</template>

<style scoped>
.mermaid-block {
  min-height: 72px;
  margin: 14px 0;
  overflow: hidden;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: color-mix(in srgb, var(--whisper-mist) 45%, var(--whisper-surface));
}
.mermaid-canvas {
  padding: 18px;
  overflow-x: auto;
  text-align: center;
}
.mermaid-canvas :deep(svg) {
  display: inline-block;
  max-width: 100%;
  height: auto;
  font-family: inherit;
}
.mermaid-status {
  margin: 0;
  padding: 18px;
  color: var(--whisper-ink-faint);
  font-size: 13px;
  text-align: center;
}
.mermaid-fallback pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  border-top: 1px solid var(--whisper-line);
  background: var(--whisper-mist);
}
.mermaid-fallback code {
  color: var(--whisper-ink-soft);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
}
</style>
