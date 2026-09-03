import { defineStore } from 'pinia'
import type { User } from '@/types/auth'

function readUser(): User | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: readUser() as User | null
  }),
  actions: {
    setToken(token: string): void {
      this.token = token
      localStorage.setItem('token', token)
    },
    setUser(user: User | null): void {
      this.user = user
      if (user) localStorage.setItem('user', JSON.stringify(user))
      else localStorage.removeItem('user')
    },
    logout(): void {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
