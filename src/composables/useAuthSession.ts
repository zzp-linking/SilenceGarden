import { shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'

/** 登录态与退出登录的页面无关入口，静语、管理后台或其他入口共用。 */
export function useAuthSession() {
  const userStore = useUserStore()
  const { user, isAuthenticated, mustChangePassword } = storeToRefs(userStore)
  const loggingOut = shallowRef(false)

  async function logout(): Promise<void> {
    if (loggingOut.value || !userStore.isAuthenticated) return
    loggingOut.value = true
    try {
      await userStore.logout()
    } finally {
      loggingOut.value = false
    }
  }

  return { user, isAuthenticated, mustChangePassword, loggingOut, logout }
}
