import { defineStore } from 'pinia'
import type { User } from '@/types/auth'
import { authApi, mockAuthApi } from '@/api/auth'
import { V2HttpError } from '@/api/clientV2'
import { runTransportManager } from '@/features/ai/transport'
import { runEventRenderScheduler } from '@/features/ai/streaming'
import { navigateToLogin } from '@/features/auth/navigation'

// 升级到 HttpOnly Cookie 后，主动移除旧版本遗留的可读 JWT。
localStorage.removeItem('token')

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'string'
    && typeof candidate.account === 'string'
    && (candidate.role === 'admin' || candidate.role === 'demo_user')
}

function readUser(): User | null {
  // localStorage 只用于首屏占位，最终身份仍以 HttpOnly Cookie 会话接口为准。
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readMustChangePassword(): boolean {
  return localStorage.getItem('must_change_password') === 'true'
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: readUser() as User | null,
    mustChangePassword: readMustChangePassword(),
    hydrated: false,
    hydrating: false,
    exiting: false
  }),
  getters: {
    isAuthenticated: state => state.user !== null
  },
  actions: {
    /** 同步内存用户与首屏缓存；传 null 时同时清理账号相关标记。 */
    setUser(user: User | null): void {
      this.user = user
      this.hydrated = true
      if (authApi === mockAuthApi) mockAuthApi.setUser(user)
      if (user) localStorage.setItem('user', JSON.stringify(user))
      else {
        this.mustChangePassword = false
        localStorage.removeItem('user')
        localStorage.removeItem('must_change_password')
      }
    },
    /** 应用一次服务端会话快照，包括强制改密标记。 */
    setSession(session: { user: User; must_change_password?: boolean }): void {
      this.setUser(session.user)
      this.mustChangePassword = session.must_change_password === true
      localStorage.setItem('must_change_password', String(this.mustChangePassword))
    },
    /** 提交密码修改并使用响应刷新当前会话状态。 */
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      const session = await authApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      this.setSession(session)
    },
    /** 首次导航时向服务端确认 Cookie 会话，重复调用会自动合并。 */
    async hydrate(): Promise<void> {
      if (this.hydrated || this.hydrating) return
      this.hydrating = true
      try {
        const session = await authApi.session()
        this.setSession(session)
      } catch {
        if (this.user && this.mustChangePassword) {
          this.hydrated = true
          return
        }
        // Cookie 不在或已过期时，清掉 localStorage 残留，避免未登录仍走登录接口。
        this.user = null
        this.mustChangePassword = false
        localStorage.removeItem('user')
        localStorage.removeItem('must_change_password')
      } finally {
        this.hydrating = false
        this.hydrated = true
      }
    },
    /** 主动刷新 Cookie 会话，返回是否仍保持登录。 */
    async refresh(): Promise<boolean> {
      try {
        await authApi.refresh()
        await this.hydrate()
        return true
      } catch {
        this.user = null
        this.mustChangePassword = false
        localStorage.removeItem('user')
        localStorage.removeItem('must_change_password')
        this.hydrated = true
        return false
      }
    },
    /** 主动退出先让服务端清除 HttpOnly Cookie；失败时保留当前页面以便重试。 */
    async logout(): Promise<void> {
      if (this.exiting) return
      this.exiting = true
      try {
        await authApi.logout()
      } catch (error) {
        if (!(error instanceof V2HttpError && error.status === 401)) {
          this.exiting = false
          throw error
        }
        // 服务端已认定会话无效，本地仍需完成退出。
      }
      this.finishSessionExit()
    },
    /** 服务端已经拒绝凭证时，无需再等待登出接口，直接清理本标签页。 */
    expireSession(): void {
      if (this.exiting || !this.isAuthenticated) return
      this.exiting = true
      this.finishSessionExit()
    },
    /** 全局退出收尾：关闭旧流、清同源存储，再完整导航以释放全部内存状态。 */
    finishSessionExit(): void {
      runTransportManager.closeAll()
      runEventRenderScheduler.closeAll('discard')
      this.setUser(null)
      localStorage.clear()
      sessionStorage.clear()
      navigateToLogin()
    }
  }
})
