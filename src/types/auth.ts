/** 系统支持的用户角色。 */
export type UserRole = 'admin' | 'demo_user'

/** 当前登录用户的公开资料。 */
export interface User {
  /** 用户公开 ID。 */
  id: string
  /** 登录账号名。 */
  account: string
  /** 决定路由和功能权限的用户角色。 */
  role: UserRole
}

/** 登录接口请求体。 */
export interface LoginRequest {
  /** 用户输入的账号名。 */
  account: string
  /** 用户输入的明文密码，仅用于本次 HTTPS 请求。 */
  password: string
}

/** 登录成功后的业务结果。 */
export interface LoginResponse {
  /** 已认证用户的信息。 */
  user: User
  /** 服务端附带的登录提示。 */
  msg?: string
}
