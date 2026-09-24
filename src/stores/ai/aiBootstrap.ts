/**
 * 静语公开配置：服务开关、输入上限、建议提问、剩余额度。
 * quiet 加载用于匿名终态后刷新额度，不把页面打回「正在铺开静语」。
 */
import { defineStore } from 'pinia'
import { aiApi } from '@/api/chat'
import type { BootstrapData } from '@/features/ai/model'

export const useAiBootstrapStore = defineStore('aiBootstrap', {
  state: () => ({ data: null as BootstrapData | null, loading: false, error: '' }),
  getters: { enabled: state => state.data?.service.enabled ?? false, prompts: state => state.data?.suggested_prompts ?? [] },
  actions: {
    /** 登录态切换时丢掉旧用户的额度快照。 */
    discard(): void {
      this.data = null
      this.error = ''
    },
    /**
     * 拉取 bootstrap。
     * @param options.quiet true 时不置 loading，避免闪全屏占位
     */
    async load(options?: { quiet?: boolean }): Promise<BootstrapData> {
      if (!options?.quiet) this.loading = true
      this.error = ''
      try { const data = await aiApi.bootstrap(); this.data = data; return data } catch (error) { this.error = error instanceof Error ? error.message : '无法读取静语状态'; throw error } finally { this.loading = false }
    }
  }
})
