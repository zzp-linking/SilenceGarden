import { defineStore } from 'pinia'
import { aiApi } from '@/api/chat'
import type { BootstrapData } from '@/types/ai'

export const useAiBootstrapStore = defineStore('aiBootstrap', {
  state: () => ({ data: null as BootstrapData | null, loading: false, error: '' }),
  getters: { enabled: state => state.data?.service.enabled ?? false, prompts: state => state.data?.suggested_prompts ?? [] },
  actions: {
    async load(): Promise<BootstrapData> {
      this.loading = true; this.error = ''
      try { const data = await aiApi.bootstrap(); this.data = data; return data } catch (error) { this.error = error instanceof Error ? error.message : '无法读取静语状态'; throw error } finally { this.loading = false }
    }
  }
})
