<script setup lang="ts">
import { reactive } from 'vue'
import type { AgentToolConfig } from '@/api/agentToolAdmin'

const props = defineProps<{
  config: AgentToolConfig // 仅包含凭据配置状态的已读快照。
  busy: boolean // 刷新或提交时锁定表单。
  save: (key: string | null) => Promise<boolean> // null 表示确认清除。
}>()
const form = reactive({ key: '' }) // 明文仅在本表单和当前保存请求中存在。

/** 保存非空密钥，成功后清空输入。 */
async function replace() {
  const key = form.key.trim()
  if (props.busy || !key) return
  if (await props.save(key)) form.key = ''
}

/** 清除已配置的密钥及任何尚未提交的输入。 */
async function clear() {
  if (!props.busy && await props.save(null)) form.key = ''
}
</script>

<template>
  <a-card title="网页搜索 · DeepSeek">
    <a-space direction="vertical" style="width: 100%">
      <a-tag :color="config.credential_available ? 'green' : config.has_api_key ? 'orange' : 'default'">
        {{ config.credential_available ? '密钥已配置' : config.has_api_key ? '已保存的密钥不可用，请重新录入' : '尚未配置密钥' }}
      </a-tag>
      <a-form :model="form" layout="vertical" @finish="replace">
        <a-form-item label="DeepSeek API Key" name="key" html-for="deepseek-search-key"
          extra="在 DeepSeek 开放平台创建或复制 API Key。保存后后台只显示配置状态。">
          <a-input-password id="deepseek-search-key" v-model:value="form.key" autocomplete="new-password"
            :maxlength="512" :disabled="busy" placeholder="输入 DeepSeek API Key" />
        </a-form-item>
        <a-space wrap>
          <a-button type="primary" html-type="submit" :disabled="busy || !form.key.trim()">
            {{ config.has_api_key ? '替换密钥' : '保存密钥' }}
          </a-button>
          <a-popconfirm v-if="config.has_api_key" title="清除后，新的对话将无法使用网页搜索。"
            ok-text="清除" cancel-text="取消" :disabled="busy" @confirm="clear">
            <a-button danger :disabled="busy">清除密钥</a-button>
          </a-popconfirm>
        </a-space>
      </a-form>
    </a-space>
  </a-card>
</template>
