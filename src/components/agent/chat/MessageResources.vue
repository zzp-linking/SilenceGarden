<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { agentChatApi } from '@/api/agentChat'
import { V2HttpError } from '@/api/clientV2'
import { isAgentArtifact, safeWebSourceURL, type AgentArtifact, type AgentSource } from '@/features/agent/chat/model'

const props = defineProps<{
  sources?: AgentSource[] // 已保存的知识和网页引用。
  artifacts?: AgentArtifact[] // 已保存的文件附件。
}>()
const attachments = computed(() => (props.artifacts ?? []).filter(isAgentArtifact)) // 只渲染可安全定位的附件。
const now = shallowRef(Date.now()) // 到期时刷新链接状态。
const downloadLifetime = new AbortController() // 消息离开页面时取消附件读取。
const downloading = shallowRef('') // 当前读取的附件 ID，避免重复触发下载。
const downloadError = shallowRef('') // 当前消息附件的安全错误提示。
let expiryTimer: ReturnType<typeof setTimeout> | undefined // 下一份附件到期的定时器。

/** 仅在最近一份附件到期时刷新，无需定期轮询。 */
function scheduleExpiry() {
  clearTimeout(expiryTimer)
  now.value = Date.now()
  const next = Math.min(...attachments.value.map(item => Date.parse(item.expires_at)).filter(time => time > now.value))
  if (Number.isFinite(next)) expiryTimer = setTimeout(scheduleExpiry, Math.min(next - now.value, 2147483647))
}

watch(attachments, scheduleExpiry, { immediate: true })
onUnmounted(() => {
  clearTimeout(expiryTimer)
  downloadLifetime.abort()
})

/** 通过会话续期客户端读取 file，再用临时对象 URL 触发浏览器保存。 */
async function download(file: AgentArtifact) {
  if (downloading.value) return
  if (Date.parse(file.expires_at) <= Date.now()) {
    scheduleExpiry()
    return
  }
  downloading.value = file.asset_id
  downloadError.value = ''
  const { signal } = downloadLifetime
  try {
    const response = await agentChatApi.downloadAsset(file.asset_id, signal)
    const blob = await response.blob()
    if (signal.aborted) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    try {
      link.click()
    } finally {
      link.remove()
      // 给浏览器时间接管对象 URL，再释放内存。
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (cause) {
    if (!signal.aborted) downloadError.value = cause instanceof V2HttpError ? cause.message : '附件下载失败，请重试'
  } finally {
    downloading.value = ''
  }
}
</script>

<template>
  <details v-if="sources?.length" class="message-resources">
    <summary>{{ sources.some(source => source.kind) ? '引用来源' : '知识库来源' }}（{{ sources.length }}）</summary>
    <ul>
      <li v-for="source in sources" :key="source.id">
        <a v-if="source.kind && safeWebSourceURL(source.url)" :href="safeWebSourceURL(source.url)"
          target="_blank" rel="noopener noreferrer">[{{ source.id }}] {{ source.title }}</a>
        <strong v-else>[{{ source.id }}] {{ source.title }}</strong>
        <span v-if="source.kind"> · {{ source.kind === 'web_search' ? '搜索摘要' : '网页正文' }}</span>
        <span v-if="source.heading?.length"> · {{ source.heading.join(' / ') }}</span>
        <span v-if="source.page"> · 第 {{ source.page }} 页</span>
      </li>
    </ul>
  </details>
  <section v-if="attachments.length" class="message-resources" aria-label="下载附件">
    <strong>下载附件</strong>
    <ul>
      <li v-for="file in attachments" :key="file.asset_id">
        <button v-if="Date.parse(file.expires_at) > now" type="button" class="attachment-download"
          :disabled="!!downloading" @click="download(file)">
          {{ file.name }}{{ downloading === file.asset_id ? ' · 下载中' : '' }}
        </button>
        <span v-else>{{ file.name }} · 已过期</span>
        <span v-if="Date.parse(file.expires_at) > now"> · {{ new Date(file.expires_at).toLocaleString() }} 到期</span>
      </li>
    </ul>
    <p v-if="downloadError" role="alert">{{ downloadError }}</p>
  </section>
</template>

<style scoped>
.message-resources { margin-top: 12px; color: var(--agent-muted); font-size: 13px; }
.message-resources summary { cursor: pointer; }
.message-resources ul { margin: 8px 0 0; padding-inline-start: 20px; }
.message-resources li { overflow-wrap: anywhere; }
.attachment-download { padding: 0; border: 0; background: none; color: #1677ff; font: inherit; cursor: pointer; text-align: start; }
.attachment-download:hover:not(:disabled) { text-decoration: underline; }
.attachment-download:disabled { color: var(--agent-muted); cursor: wait; }
</style>
