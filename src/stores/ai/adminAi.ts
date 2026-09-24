import { defineStore } from 'pinia'
import { V2HttpError } from '@/api/clientV2'
import { adminApi, type PageOptions } from '@/api/admin'
import type { AdminUsage, AdminUserListItem, AdminUserPage, AiSettings, AuditLog, FailureLog, MetadataPage } from '@/types/admin'

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof V2HttpError) return `${error.apiError.code}：${error.message}`
  return error instanceof Error ? error.message : fallback
}

export const useAdminAiStore = defineStore('adminAi', {
  state: () => ({
    usage: null as AdminUsage | null,
    users: [] as AdminUserListItem[],
    usersPage: null as AdminUserPage | null,
    settings: null as AiSettings | null,
    failures: [] as FailureLog[],
    failuresPage: null as MetadataPage<FailureLog> | null,
    audits: [] as AuditLog[],
    auditsPage: null as MetadataPage<AuditLog> | null,
    loading: false,
    error: '',
    errorCode: ''
  }),
  actions: {
    /** 清除上一次管理请求留下的展示错误。 */
    clearError(): void {
      this.error = ''
      this.errorCode = ''
    },
    /** 将未知异常归一化为后台页面可展示的消息和稳定错误码。 */
    setError(error: unknown, fallback: string): void {
      this.error = errorMessage(error, fallback)
      this.errorCode = error instanceof V2HttpError ? error.apiError.code : ''
    },
    /** 加载后台总览用量和运行诊断。 */
    async loadUsage(): Promise<void> {
      this.loading = true
      this.clearError()
      try { this.usage = await adminApi.usage() } catch (error) { this.setError(error, '总览加载失败') } finally { this.loading = false }
    },
    /** 加载一页用户及其当日用量。 */
    async loadUsers(options?: PageOptions): Promise<void> {
      this.loading = true
      this.clearError()
      try {
        this.usersPage = await adminApi.users(options)
        this.users = this.usersPage.users
      } catch (error) { this.setError(error, '用户加载失败') } finally { this.loading = false }
    },
    /** 加载可编辑的全局 AI 设置。 */
    async loadSettings(): Promise<void> {
      this.loading = true
      this.clearError()
      try { this.settings = await adminApi.settings() } catch (error) { this.setError(error, '配置加载失败') } finally { this.loading = false }
    },
    /** 加载一页不含用户内容的失败元数据。 */
    async loadFailures(options?: PageOptions): Promise<void> {
      this.loading = true
      this.clearError()
      try {
        this.failuresPage = await adminApi.failures(options)
        this.failures = this.failuresPage.items
      } catch (error) { this.setError(error, '失败日志加载失败') } finally { this.loading = false }
    },
    /** 加载一页管理员操作审计记录。 */
    async loadAudits(options?: PageOptions): Promise<void> {
      this.loading = true
      this.clearError()
      try {
        this.auditsPage = await adminApi.auditLogs(options)
        this.audits = this.auditsPage.items
      } catch (error) { this.setError(error, '审计日志加载失败') } finally { this.loading = false }
    }
  }
})
