import { reactive, readonly } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

const state = reactive({ items: [] as ToastItem[] })
let seq = 0
const MAX_VISIBLE = 3

function dismiss(id: number): void {
  const index = state.items.findIndex(item => item.id === id)
  if (index >= 0) state.items.splice(index, 1)
}

function push(text: string, kind: ToastKind = 'info', duration = 2600): void {
  const item: ToastItem = { id: ++seq, kind, text }
  state.items.push(item)
  if (state.items.length > MAX_VISIBLE) state.items.shift()
  window.setTimeout(() => dismiss(item.id), duration)
}

/** 轻提示：模块级单例，配合 <ToastHost /> 渲染。 */
export function useToast() {
  return {
    items: readonly(state.items),
    push,
    dismiss,
    info: (text: string) => push(text, 'info'),
    success: (text: string) => push(text, 'success'),
    error: (text: string) => push(text, 'error', 3800)
  }
}
