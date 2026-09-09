import { defineStore } from 'pinia'
import type { User } from '@/types/auth'
import { authApi, mockAuthApi } from '@/api/auth'
import { runTransportManager } from '@/transport'

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
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: readUser() as User | null,
    hydrated: false,
    hydrating: false
  }),
  getters: {
    isAuthenticated: state => state.user !== null
  },
  actions: {
    setUser(user: User | null): void {
      this.user = user
      this.hydrated = true
      if (authApi === mockAuthApi) mockAuthApi.setUser(user)
      if (user) localStorage.setItem('user', JSON.stringify(user))
      else localStorage.removeItem('user')
    },
    async hydrate(): Promise<void> {
      if (this.hydrated || this.hydrating) return
      this.hydrating = true
      try {
        const session = await authApi.session()
        this.user = session.user
        localStorage.setItem('user', JSON.stringify(session.user))
      } catch {
        // Anonymous static pages remain usable when the optional session is absent.
        this.user = this.user ?? null
      } finally {
        this.hydrating = false
        this.hydrated = true
      }
    },
    async refresh(): Promise<boolean> {
      try {
        await authApi.refresh()
        await this.hydrate()
        return true
      } catch {
        this.user = null
        localStorage.removeItem('user')
        this.hydrated = true
        return false
      }
    },
    async logout(): Promise<void> {
      await authApi.logout().catch(() => undefined)
      runTransportManager.closeAll()
      this.user = null
      this.hydrated = true
      localStorage.removeItem('user')
    }
  }
})
