import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { V2HttpError } from '@/api/clientV2'
import type { PageOptions } from '@/api/admin'

export function adminError(reason: unknown, fallback = '操作失败，请稍后重试'): string {
  if (reason instanceof V2HttpError) return `${reason.apiError.code}：${reason.message}`
  return reason instanceof Error ? reason.message : fallback
}

/** Each panel owns its request state; stale responses cannot update an unmounted panel. */
export function useAdminResource<T>(loader: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef('')
  let epoch = 0
  onBeforeUnmount(() => { epoch++ })
  async function load(): Promise<boolean> {
    if (loading.value) return false
    const ticket = ++epoch
    loading.value = true
    error.value = ''
    try {
      const result = await loader()
      if (ticket !== epoch) return false
      data.value = result
      return true
    } catch (reason) {
      if (ticket === epoch) error.value = adminError(reason, '数据加载失败')
      return false
    } finally { if (ticket === epoch) loading.value = false }
  }
  return { data, loading, error, load }
}

/** Cursor history offers previous/next navigation without inventing totals or page offsets. */
export function useAdminCursorPage<T extends { next_cursor?: string }>(loader: (options: PageOptions) => Promise<T>) {
  const cursors = ref<Array<string | undefined>>([undefined])
  const index = shallowRef(0)
  let requestedCursor: string | undefined
  const resource = useAdminResource(() => loader({ cursor: requestedCursor, limit: 50 }))
  async function go(target: number, cursor: string | undefined) {
    if (resource.loading.value) return
    requestedCursor = cursor
    if (await resource.load()) index.value = target
  }
  async function next() {
    const cursor = resource.data.value?.next_cursor
    if (!cursor || resource.loading.value) return
    const target = index.value + 1
    await go(target, cursor)
    if (index.value === target) cursors.value = [...cursors.value.slice(0, target), cursor]
  }
  async function previous() {
    if (index.value > 0) await go(index.value - 1, cursors.value[index.value - 1])
  }
  async function reload() { await go(index.value, cursors.value[index.value]) }
  async function first() {
    await go(0, undefined)
    if (index.value === 0 && !resource.error.value) cursors.value = [undefined]
  }
  return { ...resource, index, next, previous, reload, first }
}
