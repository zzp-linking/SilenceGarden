<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { adminApi } from '@/api/admin'
import type { AdminUserId } from '@/types/admin'
import { microCnyToYuan } from '@/utils/microCny'
import { useAdminAiStore } from '@/stores/ai/adminAi'

const store = useAdminAiStore()
const { users, usersPage, loading, error } = storeToRefs(store)
const account = ref('')
const temporaryPassword = ref('')
const notice = ref('')
const hasNext = computed(() => Boolean(usersPage.value?.next_cursor))

/** 创建账号并暂存只展示一次的临时密码。 */
async function create(): Promise<void> {
  if (!account.value.trim()) return
  try {
    const result = await adminApi.createUser({ account: account.value.trim() })
    temporaryPassword.value = result.temporary_password ?? ''
    account.value = ''
    notice.value = '账号已创建，临时密码只展示一次。'
    await store.loadUsers()
  } catch (reason) { store.setError(reason, '创建用户失败') }
}

/** 使用当前修订号启用或停用账号，避免覆盖并发管理操作。 */
async function toggle(id: AdminUserId, active: boolean, revision: number): Promise<void> {
  try {
    await adminApi.updateUser(id, revision, { status: active ? 'disabled' : 'active' })
    await store.loadUsers()
  } catch (reason) { store.setError(reason, '用户状态更新失败') }
}

/** 重置密码并展示服务端一次性返回的临时密码。 */
async function reset(id: AdminUserId, revision: number): Promise<void> {
  try {
    const result = await adminApi.resetPassword(id, revision)
    temporaryPassword.value = result.temporary_password ?? ''
    notice.value = '密码已重置，临时密码只展示一次。'
    await store.loadUsers()
  } catch (reason) { store.setError(reason, '密码重置失败') }
}

async function resetQuota(id: AdminUserId): Promise<void> {
  try {
    await adminApi.resetQuota(id)
    notice.value = '已增加当天执行 credit，真实消费总额未被清零。'
    await store.loadUsers()
  } catch (reason) { store.setError(reason, '额度重置失败') }
}

/** 提交异步删除任务；实际数据清理由服务端后台作业完成。 */
async function remove(id: AdminUserId, accountName: string): Promise<void> {
  if (!window.confirm(`确认删除账号“${accountName}”及其全部对话？`)) return
  try {
    const job = await adminApi.deleteUser(id)
    notice.value = `删除任务已提交：${job.job_id}（${job.state}）`
    await store.loadUsers()
  } catch (reason) { store.setError(reason, '删除任务提交失败') }
}

async function loadMore(): Promise<void> {
  // 游标由服务端签发，客户端不解析，只在翻页时原样回传。
  const cursor = usersPage.value?.next_cursor
  if (!cursor) return
  await store.loadUsers({ cursor })
}

onMounted(() => { void store.loadUsers() })
</script>

<template>
  <section class="admin-page">
    <header class="page-head"><div><span class="eyebrow">账号生命周期</span><h1>用户管理</h1></div></header>
    <form class="create-form" @submit.prevent="create"><input v-model="account" placeholder="新 demo_user 账号" aria-label="新账号" /><button type="submit" :disabled="loading">创建演示账号</button></form>
    <p v-if="notice" class="notice">{{ notice }}</p>
    <p v-if="temporaryPassword" class="password">临时密码：<code>{{ temporaryPassword }}</code></p>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>账号</th><th>角色/状态</th><th>有效期</th><th>今日轮数</th><th>今日费用</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in users" :key="item.user.id">
            <td>{{ item.user.account }}</td>
            <td>{{ item.user.role }} / {{ item.user.status }}<small v-if="item.user.must_change_password">需改密</small></td>
            <td>{{ item.user.expires_at || '未设置' }}</td>
            <td>{{ item.usage.answer_rounds }}</td>
            <td>¥{{ microCnyToYuan(item.usage.actual_micro_cny) }}</td>
            <td class="actions">
              <button type="button" @click="toggle(item.user.id, item.user.status === 'active', item.user.revision)">{{ item.user.status === 'active' ? '禁用' : '启用' }}</button>
              <button type="button" @click="reset(item.user.id, item.user.revision)">重置密码</button>
              <button type="button" @click="resetQuota(item.user.id)">加执行 credit</button>
              <button type="button" @click="remove(item.user.id, item.user.account)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="loading">正在读取……</p>
      <button v-if="hasNext" class="more" type="button" :disabled="loading" @click="loadMore">读取下一页</button>
    </div>
  </section>
</template>

<style scoped>
.admin-page { max-width: 1100px; }
.page-head h1 { margin: .4rem 0 1.8rem; font: 2.2rem 'STKaiti', serif; color: #31533e; }
.eyebrow { color: #8a998c; font-size: .7rem; letter-spacing: .15em; }
.create-form { display: flex; gap: .6rem; margin-bottom: 1rem; }
.create-form input { flex: 1; max-width: 320px; padding: .7rem; border: 1px solid #dce5da; border-radius: 8px; }
.create-form button, .actions button, .more { padding: .55rem .7rem; border: 1px solid #b7ccb8; border-radius: 7px; background: #fff; color: #477458; cursor: pointer; }
.create-form button { background: #477458; color: #fff; }
button:disabled { cursor: wait; opacity: .6; }
.notice { color: #477458; }
.password { padding: .8rem; background: #fff4df; color: #8b693e; }
.error { color: #966565; white-space: pre-wrap; }
.table-wrap { overflow: auto; background: #fff; border: 1px solid #e0e8de; border-radius: 12px; }
table { width: 100%; border-collapse: collapse; text-align: left; }
th, td { padding: .8rem 1rem; border-bottom: 1px solid #edf1eb; font-size: .8rem; vertical-align: top; }
th { color: #8a998c; font-weight: 500; }
td small { display: block; color: #9a7777; }
.actions { display: flex; gap: .35rem; flex-wrap: wrap; }
.more { display: block; margin: .8rem auto; }
</style>
