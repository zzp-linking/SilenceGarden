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
  /** 读取并解码指定名称的 Cookie。 */
  get(name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  },

  /** 通过写入 Unix 纪元过期时间删除当前应用路径下的 Cookie。 */
  del(name: string): void {
    document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=${COOKIE_PATH}`
  },

  /** 写入当前应用路径下的 Cookie；duration 支持 10s、2h、7d。 */
  set(name: string, value: string, duration?: string): void {
    const expires = duration ? `;expires=${new Date(Date.now() + getsec(duration)).toUTCString()}` : ''
    document.cookie = `${name}=${encodeURIComponent(value)}${expires};path=${COOKIE_PATH}`
  }
}
