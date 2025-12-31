import { defineStore } from 'pinia'

export const useGlobalStore = defineStore('global', {
  state: () => ({
    loading: false,
    progress: false
  }),
  actions: {
    setLoading(status) {
      if (status) {
        this.loading = true
      } else {
        setTimeout(() => {
          this.loading = false
        }, 200)
      }
    },
    setProgress(status) {
      this.progress = status
    }
  }
})

