import { defineStore } from 'pinia'

interface GlobalState {
  loading: boolean
  progress: boolean
}

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({ loading: false, progress: false }),
  actions: {
    setLoading(status: boolean): void {
      if (status) this.loading = true
      else setTimeout(() => { this.loading = false }, 200)
    },
    setProgress(status: boolean): void {
      this.progress = status
    }
  }
})
