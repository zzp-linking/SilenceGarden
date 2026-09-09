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
    clearError(): void {
      this.error = ''
      this.errorCode = ''
    },
    setError(error: unknown, fallback: string): void {
      this.error = errorMessage(error, fallback)
      this.errorCode = error instanceof V2HttpError ? error.apiError.code : ''
    },
    async loadUsage(): Promise<void> {
      this.loading = true
      this.clearError()
      try { this.usage = await adminApi.usage() } catch (error) { this.setError(error, '总览加载失败') } finally { this.loading = false }
    },
    async loadUsers(options?: PageOptions): Promise<void> {
      this.loading = true
      this.clearError()
      try {
        this.usersPage = await adminApi.users(options)
        this.users = this.usersPage.users
      } catch (error) { this.setError(error, '用户加载失败') } finally { this.loading = false }
    },
    async loadSettings(): Promise<void> {
      this.loading = true
      this.clearError()
      try { this.settings = await adminApi.settings() } catch (error) { this.setError(error, '配置加载失败') } finally { this.loading = false }
    },
    async loadFailures(options?: PageOptions): Promise<void> {
      this.loading = true
      this.clearError()
      try {
        this.failuresPage = await adminApi.failures(options)
        this.failures = this.failuresPage.items
      } catch (error) { this.setError(error, '失败日志加载失败') } finally { this.loading = false }
    },
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
