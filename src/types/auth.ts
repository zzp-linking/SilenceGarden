export type UserRole = 'admin' | 'demo_user'

export interface User {
  id: string
  account: string
  role: UserRole
}

export interface LoginRequest {
  account: string
  password: string
}

export interface LoginResponse {
  user: User
  msg?: string
}
