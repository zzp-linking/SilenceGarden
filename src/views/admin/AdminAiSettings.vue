<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { V2HttpError } from '@/api/clientV2'
import { adminApi } from '@/api/admin'
import AdminSettingsForm from '@/components/admin/AdminSettingsForm.vue'
import type { AiSettings } from '@/types/admin'
import { useAdminAiStore } from '@/stores/ai/adminAi'

const store = useAdminAiStore()
const { settings, loading, error, errorCode } = storeToRefs(store)
const notice = ref('')
const enabled = computed(() => settings.value?.service.enabled === true)

function displayError(fallback: string, reason: unknown): string {
  if (reason instanceof V2HttpError) return `${reason.apiError.code}：${reason.message}`
  return reason instanceof Error ? reason.message : fallback
}

async function load(): Promise<void> {
  notice.value = ''
  await store.loadSettings()
}

/** 保存完整配置；版本冲突时重新加载服务端最新修订。 */
async function save(next: AiSettings): Promise<void> {
  notice.value = ''
  try {
    store.settings = await adminApi.updateSettings(next.revision, next)
    notice.value = '完整 settings 已保存，revision 已更新。'
  } catch (reason) {
    notice.value = displayError('配置保存失败', reason)
    if (reason instanceof V2HttpError && reason.apiError.code === 'SETTINGS_VERSION_CONFLICT') await load()
  }
}

/** 开关 AI 服务；关闭只阻止新任务，不中断已经开始的回答。 */
async function toggle(): Promise<void> {
  const current = settings.value
  if (!current) return
  const message = current.service.maintenance_message || '静语正在休息，历史仍可查看。'
  const wasEnabled = enabled.value
  if (wasEnabled && !window.confirm('关闭后新的模型请求会被拒绝，已开始的回答仍将完成。')) return
  notice.value = ''
  try {
    if (wasEnabled) await adminApi.disable(current.revision, message)
    else await adminApi.enable(current.revision)
    await load()
    notice.value = wasEnabled ? '服务已关闭。' : '服务已开启。'
  } catch (reason) {
    notice.value = displayError('服务开关操作失败', reason)
    if (reason instanceof V2HttpError && reason.apiError.code === 'SETTINGS_VERSION_CONFLICT') await load()
  }
}

onMounted(() => { void load() })
</script>

<template>
  <section class="admin-page">
    <header class="page-head">
      <div><span class="eyebrow">可控边界</span><h1>AI 设置</h1></div>
      <span class="revision">revision {{ settings?.revision ?? '—' }}</span>
    </header>
    <div class="service-card">
      <div><strong>{{ enabled ? '服务开启' : '服务关闭' }}</strong><p>{{ settings?.service.maintenance_message || '本地数据库尚未读取设置。' }}</p></div>
      <button type="button" :class="{ enabled }" :disabled="!settings || loading" @click="toggle">{{ enabled ? '关闭服务' : '开启服务' }}</button>
    </div>
    <p v-if="error || errorCode" class="error">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>
    <p v-if="!settings && loading" class="hint">正在读取完整 settings……</p>
    <AdminSettingsForm v-if="settings" :settings="settings" :busy="loading" @save="save" />
  </section>
</template>

<style scoped>
.admin-page { max-width: 1120px; }
.page-head { display: flex; justify-content: space-between; align-items: end; gap: 1rem; }
.eyebrow { color: #8a9b8c; font-size: .7rem; letter-spacing: .15em; }
.admin-page h1 { margin: .4rem 0 1.8rem; font: 2.2rem 'STKaiti', serif; color: #31533e; }
.revision { color: #8a998c; font: .75rem ui-monospace, monospace; }
.service-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.2rem; border: 1px solid #e0e8de; border-radius: 12px; background: #fff; }
.service-card strong { color: #31533e; }
.service-card p { margin: .4rem 0 0; color: #8a998c; font-size: .78rem; }
.service-card button { padding: .65rem .9rem; border: 1px solid #d4b4b4; border-radius: 8px; background: #fff; color: #946666; cursor: pointer; }
.service-card button.enabled { border-color: #d4b4b4; background: #fff; }
.service-card button:disabled { cursor: wait; opacity: .6; }
.notice { color: #477458; }
.error { color: #966565; white-space: pre-wrap; }
.hint { color: #8a998c; }
</style>
