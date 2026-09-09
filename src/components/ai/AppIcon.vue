<script setup lang="ts">
import { computed } from 'vue'

/**
 * Lucide 图标（ISC，https://lucide.dev）。
 * SVG 文件位于 src/assets/icons/，为构建期可信本地资产；
 * 新增图标时把同名 svg 放进该目录即可。
 */
export type IconName =
  | 'arrow-down' | 'arrow-up' | 'arrow-up-right'
  | 'check' | 'chevron-down' | 'chevron-left' | 'chevron-right'
  | 'copy' | 'ellipsis' | 'image' | 'loader-circle' | 'log-in'
  | 'menu' | 'panel-left-close' | 'panel-left-open' | 'pencil'
  | 'plus' | 'refresh-cw' | 'search' | 'sparkles' | 'square'
  | 'square-pen' | 'trash-2' | 'x'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

const modules = import.meta.glob('../../assets/icons/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const icons: Record<string, string> = {}
for (const [path, raw] of Object.entries(modules)) {
  const match = /\/([^/]+)\.svg$/.exec(path)
  if (match) icons[match[1] as string] = raw
}

const svg = computed(() => icons[props.name] ?? '')
const box = computed(() => `${props.size}px`)
</script>

<template>
  <span class="app-icon" :style="{ width: box, height: box }" aria-hidden="true" v-html="svg"></span>
</template>

<style scoped>
.app-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}
.app-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
