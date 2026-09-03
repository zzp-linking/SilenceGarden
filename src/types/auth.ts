export interface User {
  _id?: string
  account: string
}

export interface LoginRequest {
  account: string
  password: string
}

export interface LoginResponse {
  token: string
  msg?: string
}
