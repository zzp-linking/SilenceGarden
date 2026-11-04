import type { Router } from 'vue-router'
import { PUBLIC_PATH } from '@/config/url'

/** 从浏览器地址提取站内路由，供退出后重新登录返回使用。 */
export function currentBackUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location): string {
  const pathname = location.pathname
  if (pathname !== PUBLIC_PATH && !pathname.startsWith(`${PUBLIC_PATH}/`)) return '/'
  const routePath = pathname.slice(PUBLIC_PATH.length) || '/'
  if (routePath === '/login') return '/'
  return `${routePath}${location.search}${location.hash}`
}

/** 构造带站内返回地址的登录 URL，并保留部署使用的 /home 前缀。 */
export function loginHref(backUrl = currentBackUrl()): string {
  const query = new URLSearchParams({ backUrl })
  return `${PUBLIC_PATH}/login?${query.toString()}`
}

/** 完整页面导航会重建 Pinia 和模块级内存；replace 避免后退回旧账号页面。 */
export function navigateToLogin(backUrl = currentBackUrl()): void {
  window.location.replace(loginHref(backUrl))
}

/** 只接受当前路由表中的站内地址，避免 backUrl 造成外站跳转或登录页循环。 */
export function safeReturnPath(router: Router, value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const target = router.resolve(value)
    if (!target.matched.length || target.name === 'Login') return null
    return target.fullPath
  } catch {
    return null
  }
}
