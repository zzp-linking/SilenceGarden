<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { App } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { formatAdminTime } from '@/utils/adminDisplay'
import { adminApi } from '@/api/admin'
import type { AdminUserListItem } from '@/types/admin'
import { microCnyToYuan } from '@/utils/microCny'
import { adminError, useAdminCursorPage } from '@/composables/useAdminResource'

const { message } = App.useApp()
const page = useAdminCursorPage(options => adminApi.users(options))
const { data, loading, error, index } = page
const users = computed(() => data.value?.users || [])
const createOpen = shallowRef(false)
const busy = shallowRef(false)
const actionError = shallowRef('')
const password = shallowRef('')
const form = reactive({ account: '' })
const columns = [
  { title: '账号', key: 'account', width: 260 },
  { title: '角色 / 状态', key: 'status', width: 180 },
  { title: '有效期', dataIndex: ['user', 'expires_at'], key: 'expires', width: 200 },
  { title: '今日轮数', dataIndex: ['usage', 'answer_rounds'], width: 110 },
  { title: '今日费用', key: 'cost', width: 120 },
  { title: '操作', key: 'actions', width: 360 }
]
async function create() {
  if (busy.value || !form.account.trim()) return
  busy.value = true; actionError.value = ''
  try {
    const result = await adminApi.createUser({ account: form.account.trim() })
    password.value = result.temporary_password || ''
    form.account = ''; createOpen.value = false
    message.success('账号已创建')
    await page.first()
  } catch (reason) { actionError.value = adminError(reason) }
  finally { busy.value = false }
}
async function command(kind: 'toggle' | 'reset' | 'quota' | 'delete', item: AdminUserListItem) {
  if (busy.value) return
  busy.value = true; actionError.value = ''
  try {
    const user = item.user
    if (kind === 'toggle') await adminApi.updateUser(user.id, user.revision, { status: user.status === 'active' ? 'disabled' : 'active' })
    if (kind === 'reset') password.value = (await adminApi.resetPassword(user.id, user.revision)).temporary_password || ''
    if (kind === 'quota') await adminApi.resetQuota(user.id)
    if (kind === 'delete') await adminApi.deleteUser(user.id)
    message.success(kind === 'quota' ? '已增加当天执行额度，实际消费保持不变' : kind === 'reset' ? '密码已重置' : kind === 'delete' ? '账号及相关数据库数据已删除' : '账号状态已更新')
    await page.reload()
  } catch (reason) { actionError.value = adminError(reason) }
  finally { busy.value = false }
}
onMounted(page.first)
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-head">
      <div><h1 class="admin-page-title">用户管理</h1><p class="admin-page-description">管理演示账号、访问状态与当日执行额度。</p></div>
      <a-button type="primary" @click="actionError = ''; createOpen = true"><PlusOutlined />创建演示账号</a-button>
    </header>
    <a-alert v-if="error || actionError" type="error" show-icon :message="error || actionError" />
    <a-alert v-if="password" type="warning" show-icon closable @close="password = ''">
      <template #message>临时密码只展示一次，请妥善交付后关闭提示。</template>
      <template #description><a-typography-text code copyable>{{ password }}</a-typography-text></template>
    </a-alert>
    <a-card :bordered="false">
      <div class="admin-toolbar"><a-space><strong>账号列表</strong><a-tag>{{ users.length }} 个 / 当前页</a-tag></a-space><a-button :loading="loading" :disabled="busy" @click="page.reload"><template #icon><ReloadOutlined /></template>刷新</a-button></div>
      <a-table :columns="columns" :data-source="users" :row-key="(item: AdminUserListItem) => item.user.id" :loading="loading || busy" :pagination="false" :scroll="{ x: 1230 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'account'">
            <div class="account-cell">
              <a-typography-text strong ellipsis :title="record.user.account" class="account-name">{{ record.user.account }}</a-typography-text>
              <a-tag v-if="record.user.must_change_password" color="orange" class="account-password-tag">需修改密码</a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'status'"><a-space wrap><a-tag>{{ record.user.role === 'admin' ? '管理员' : '演示用户' }}</a-tag><a-badge :status="record.user.status === 'active' ? 'success' : 'default'" :text="record.user.status === 'active' ? '已启用' : '已禁用'" /></a-space></template>
          <template v-else-if="column.key === 'expires'">{{ record.user.expires_at ? formatAdminTime(record.user.expires_at) : '长期有效' }}</template>
          <template v-else-if="column.key === 'cost'">¥{{ microCnyToYuan(record.usage.actual_micro_cny) }}</template>
          <template v-else-if="column.key === 'actions'">
            <a-space :size="4" wrap>
              <a-popconfirm :title="record.user.status === 'active' ? '确认禁用此账号？' : '确认启用此账号？'" @confirm="command('toggle', record)"><a-button type="link" size="small" :disabled="busy || loading">{{ record.user.status === 'active' ? '禁用' : '启用' }}</a-button></a-popconfirm>
              <a-popconfirm title="确认重置此账号密码？" @confirm="command('reset', record)"><a-button type="link" size="small" :disabled="busy || loading">重置密码</a-button></a-popconfirm>
              <a-popconfirm title="为此账号增加当天执行额度？" @confirm="command('quota', record)"><a-button type="link" size="small" :disabled="busy || loading">增加执行额度</a-button></a-popconfirm>
              <a-popconfirm :title="'永久删除账号“' + record.user.account + '”及其数据库数据？'" :disabled="record.user.status !== 'disabled'" @confirm="command('delete', record)"><a-button type="link" danger size="small" :disabled="busy || loading || record.user.status !== 'disabled'" :title="record.user.status !== 'disabled' ? '请先禁用账号' : undefined">删除</a-button></a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
      <div class="admin-pagination"><span class="admin-muted">第 {{ index + 1 }} 页</span><a-button :disabled="index === 0 || loading || busy" @click="page.previous">上一页</a-button><a-button :disabled="!data?.next_cursor || loading || busy" @click="page.next">下一页</a-button></div>
    </a-card>
    <a-modal v-model:open="createOpen" title="创建演示账号" :footer="null" :mask-closable="!busy" :closable="!busy" :keyboard="!busy">
      <a-form :model="form" layout="vertical" @finish="create">
        <a-alert v-if="actionError" type="error" :message="actionError" show-icon class="create-alert" />
        <a-form-item label="账号" name="account" :rules="[{ required: true, whitespace: true, message: '请输入账号' }]"><a-input v-model:value="form.account" :disabled="busy" placeholder="输入新账号" autocomplete="off" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit" :loading="busy">创建账号</a-button><a-button :disabled="busy" @click="createOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>
  </section>
</template>
<style scoped>
.account-cell { display: flex; align-items: center; gap: 8px; min-width: 0; white-space: nowrap; }
.account-name { min-width: 0; }
.account-password-tag { flex-shrink: 0; margin-inline-end: 0; }
.create-alert { margin-bottom: 20px; }
</style>
