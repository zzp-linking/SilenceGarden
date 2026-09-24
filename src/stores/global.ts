import { defineStore } from 'pinia'

interface GlobalState {
  loading: boolean
  progress: boolean
}

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({ loading: false, progress: false }),
  actions: {
    setLoading(status: boolean): void {
      // 关闭时稍作延迟，避免极快请求导致加载遮罩闪烁。
      if (status) this.loading = true
      else setTimeout(() => { this.loading = false }, 200)
    },
    setProgress(status: boolean): void {
      this.progress = status
    }
  }
})
