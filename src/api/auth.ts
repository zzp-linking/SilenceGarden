import { clientV2 } from '@/api/clientV2'
import type { LoginRequest, User } from '@/types/auth'

export interface SessionData { user: User; must_change_password?: boolean }
export interface AuthApi { login(request: LoginRequest): Promise<SessionData>; session(): Promise<SessionData>; refresh(): Promise<void>; logout(): Promise<void> }

export class HttpAuthApi implements AuthApi {
  login(request: LoginRequest): Promise<SessionData> { return clientV2.request('/login', { method: 'POST', body: JSON.stringify(request) }) }
  session(): Promise<SessionData> { return clientV2.request('/session') }
  async refresh(): Promise<void> { await clientV2.request('/session/refresh', { method: 'POST' }) }
  async logout(): Promise<void> { await clientV2.request('/logout', { method: 'POST' }) }
}

export class MockAuthApi implements AuthApi {
  private user: User | null = null
  setUser(user: User | null): void { this.user = user }
  async login(request: LoginRequest): Promise<SessionData> { this.user ??= { id: `mock-${request.account}`, account: request.account, role: 'demo_user' }; return { user: this.user } }
  async session(): Promise<SessionData> {
    if (!this.user) throw new Error('no mock session')
    return { user: this.user }
  }
  async refresh(): Promise<void> { if (!this.user) throw new Error('no mock session') }
  async logout(): Promise<void> { this.user = null }
}

export const mockAuthApi = new MockAuthApi()
const useMockAuthApi = import.meta.env.MODE === 'test' || (import.meta.env.DEV && import.meta.env.VITE_AI_MOCK === 'true')
export const authApi: AuthApi = useMockAuthApi ? mockAuthApi : new HttpAuthApi()
