import { clientV2 } from '@/api/clientV2'
import type { LoginRequest, User } from '@/types/auth'

/** 会话接口返回的当前用户和密码状态。 */
export interface SessionData {
  /** 当前完成认证的用户。 */
  user: User
  /** 是否要求用户在继续使用前修改临时密码。 */
  must_change_password?: boolean
}
/** 修改密码接口请求体。 */
export interface ChangePasswordRequest {
  /** 用于再次验证身份的当前密码。 */
  current_password: string
  /** 校验通过后要设置的新密码。 */
  new_password: string
}
/** 登录态功能使用的认证接口抽象，便于测试替换为内存实现。 */
export interface AuthApi { login(request: LoginRequest): Promise<SessionData>; session(): Promise<SessionData>; changePassword(request: ChangePasswordRequest): Promise<SessionData>; refresh(): Promise<void>; logout(): Promise<void> }

/** 基于 Cookie 会话的生产认证实现。 */
export class HttpAuthApi implements AuthApi {
  login(request: LoginRequest): Promise<SessionData> { return clientV2.request('/login', { method: 'POST', body: JSON.stringify(request) }) }
  session(): Promise<SessionData> { return clientV2.request('/session') }
  // 旧密码错误也返回 401，禁止自动刷新重试以免掩盖真实表单错误。
  changePassword(request: ChangePasswordRequest): Promise<SessionData> { return clientV2.request('/password/change', { method: 'POST', body: JSON.stringify(request) }, false) }
  async refresh(): Promise<void> { await clientV2.request('/session/refresh', { method: 'POST' }) }
  async logout(): Promise<void> { await clientV2.request('/logout', { method: 'POST', body: '{}' }) }
}

/** 测试和显式开发 Mock 模式使用的内存认证实现。 */
export class MockAuthApi implements AuthApi {
  private user: User | null = null
  setUser(user: User | null): void { this.user = user }
  async login(request: LoginRequest): Promise<SessionData> { this.user ??= { id: `mock-${request.account}`, account: request.account, role: 'demo_user' }; return { user: this.user } }
  async session(): Promise<SessionData> {
    if (!this.user) throw new Error('no mock session')
    return { user: this.user }
  }
  async changePassword(_request: ChangePasswordRequest): Promise<SessionData> {
    if (!this.user) throw new Error('no mock session')
    return { user: this.user, must_change_password: false }
  }
  async refresh(): Promise<void> { if (!this.user) throw new Error('no mock session') }
  async logout(): Promise<void> { this.user = null }
}

export const mockAuthApi = new MockAuthApi()
const useMockAuthApi = import.meta.env.MODE === 'test' || (import.meta.env.DEV && import.meta.env.VITE_AI_MOCK === 'true')
export const authApi: AuthApi = useMockAuthApi ? mockAuthApi : new HttpAuthApi()
