import { defineStore } from 'pinia'
import type { User } from '@/types/auth'

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
    user: readUser() as User | null
  }),
  getters: {
    isAuthenticated: state => state.user !== null
  },
  actions: {
    setUser(user: User | null): void {
      this.user = user
      if (user) localStorage.setItem('user', JSON.stringify(user))
      else localStorage.removeItem('user')
    },
    logout(): void {
      this.user = null
      localStorage.removeItem('user')
    }
  }
})
