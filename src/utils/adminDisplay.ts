/** Go 的未设置时间不代表实际更新，运维视图中不展示该值。 */
export function formatAdminTime(value?: string): string {
  if (!value || value.startsWith('0001-')) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}

export function formatAdminDate(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value
}
