import { createPinia } from 'pinia'

/** 全应用唯一的 Pinia 实例；路由守卫和 Vue 根实例共享它。 */
export const pinia = createPinia()
