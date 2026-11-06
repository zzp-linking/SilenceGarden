<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { App } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { V2HttpError } from '@/api/clientV2'
import { adminApi } from '@/api/admin'
import AdminSettingsForm from '@/components/admin/AdminSettingsForm.vue'
import type { AiSettings } from '@/types/admin'
import { adminError, useAdminResource } from '@/composables/useAdminResource'
const { message } = App.useApp()
const { data: settings, loading, error, load } = useAdminResource<AiSettings>(readSettings)
const saving = shallowRef(false)
const switching = shallowRef(false)
const actionError = shallowRef('')
const enabled = computed(() => settings.value?.service.enabled === true)
const writing = computed(() => saving.value || switching.value)
let readTask: Promise<boolean> | undefined

async function readSettings(): Promise<AiSettings> {
  const next = await adminApi.settings()
  const current = settings.value
  // 重新加载得到相同 JSON 设置时，保留既有快照。
  return current && JSON.stringify(current) === JSON.stringify(next) ? current : next
}

function reload(): Promise<boolean> {
  if (!readTask) readTask = load().finally(() => { readTask = undefined })
  return readTask
}

async function handleError(reason: unknown) {
  if (reason instanceof V2HttpError && reason.apiError.code === 'SETTINGS_VERSION_CONFLICT') {
    const reloaded = await reload()
    actionError.value = reloaded ? '设置已被其他操作修改，已重新加载最新版本，请检查后再次保存。' : '设置版本冲突，重新读取失败，请重新加载后再保存。'
  } else actionError.value = adminError(reason)
}
async function save(next: AiSettings) {
  if (writing.value) return
  saving.value = true; actionError.value = ''
  try {
    // 写入前等待正在进行的读取结束；草稿修订号仍负责防止并发覆盖。
    if (readTask && !await readTask) return
    settings.value = await adminApi.updateSettings(next.revision, next)
    message.success('全部设置已保存')
  }
  catch (reason) { await handleError(reason) }
  finally { saving.value = false }
}
async function toggle() {
  if (!settings.value || writing.value) return
  switching.value = true; actionError.value = ''
  const wasEnabled = enabled.value
  try {
    if (readTask && !await readTask) return
    if (enabled.value !== wasEnabled) {
      message.info(wasEnabled ? 'AI 服务已经关闭' : 'AI 服务已经开启')
      return
    }
    if (wasEnabled) await adminApi.disable(settings.value.revision, settings.value.service.maintenance_message || '静语正在休息，历史仍可查看。')
    else await adminApi.enable(settings.value.revision)
    await reload()
    message.success(wasEnabled ? 'AI 服务已关闭' : 'AI 服务已开启')
  } catch (reason) { await handleError(reason) }
  finally { switching.value = false }
}
onMounted(reload)
</script>
<template>
  <section class="admin-page">
    <header class="admin-page-head"><div><h1 class="admin-page-title">AI 设置</h1><p class="admin-page-description">配置服务、配额、模型与运行策略。</p></div><a-button :loading="loading" :disabled="writing" @click="actionError = ''; reload()"><template #icon><ReloadOutlined /></template>重新加载</a-button></header>
    <a-alert v-if="error || actionError" type="error" show-icon :message="error || actionError" />
    <a-card :bordered="false">
      <div class="service-status">
        <div><a-space><strong>AI 服务</strong><a-badge :status="settings ? enabled ? 'success' : 'default' : 'processing'" :text="settings ? enabled ? '运行中' : '已关闭' : '读取中'" /></a-space><p class="service-note">{{ enabled ? '服务已开启，可接收新的模型请求。' : settings?.service.maintenance_message || '关闭服务后仍可查看历史记录。' }}</p></div>
        <a-popconfirm :title="enabled ? '确认关闭 AI 服务？' : '确认开启 AI 服务？'" :description="enabled ? '新的模型请求将被拒绝，已经开始的回答仍会完成。' : '开启后允许新的模型请求。'" @confirm="toggle"><a-button :danger="enabled" :type="enabled ? 'default' : 'primary'" :loading="switching" :disabled="!settings || saving">{{ enabled ? '关闭服务' : '开启服务' }}</a-button></a-popconfirm>
      </div>
    </a-card>
    <a-card title="全局配置" :bordered="false" :loading="!settings && loading">
      <template #extra><a-tag v-if="settings">版本 {{ settings.revision }}</a-tag></template>
      <AdminSettingsForm v-if="settings" :settings="settings" :busy="writing" @save="save" />
      <a-empty v-else-if="!loading" description="配置尚未读取，请重新加载" />
    </a-card>
  </section>
</template>
<style scoped>
.service-status { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.service-note { margin: 8px 0 0; color: #8c8c8c; }
</style>
