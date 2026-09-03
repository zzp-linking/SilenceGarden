const COOKIE_PATH = '/home'

function getsec(value: string): number {
  const match = /^(\d+)([shd])$/i.exec(value)
  if (!match) return 0

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multiplier = unit === 's' ? 1000 : unit === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  return amount * multiplier
}

export const CookieUtils = {
  get(name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  },

  del(name: string): void {
    document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=${COOKIE_PATH}`
  },

  set(name: string, value: string, duration?: string): void {
    const expires = duration ? `;expires=${new Date(Date.now() + getsec(duration)).toUTCString()}` : ''
    document.cookie = `${name}=${encodeURIComponent(value)}${expires};path=${COOKIE_PATH}`
  }
}
