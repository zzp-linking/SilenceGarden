<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ToolPolicy } from '@/api/agentToolAdmin'

const props = defineProps<{
  policies: ToolPolicy[] // 最近提交的搜索额度和保留期快照。
  busy: boolean // 管理页正在读取或保存设置。
}>()
const emit = defineEmits<{
  save: [policy: ToolPolicy, value: ToolPolicy['value']] // 提交对应策略及完整值。
}>()
const quotaKey = 'tool.web_search.quota' // 搜索额度的策略键。
const retentionKey = 'tool.assets.retention' // 文件保留期的策略键。
const quota = reactive({ per_user_daily: 0, site_daily: 0 }) // 搜索额度的编辑副本。
const retention = reactive({ download_hours: 0, export_hours: 0 }) // 文件保留期的编辑副本。

watch(() => props.policies, (policies, previous) => {
  for (const policy of policies) {
    if (previous?.find(item => item.key === policy.key) === policy) continue
    Object.assign(policy.key === quotaKey ? quota : retention, policy.value)
  }
}, { immediate: true })

/** 仅提交在后端限制内的整数设置。 */
function save(key: ToolPolicy['key']) {
  const policy = props.policies.find(item => item.key === key)
  if (!policy || props.busy) return
  const value = key === quotaKey ? quota : retention
  const within = (number: number, limit: number) => Number.isInteger(number) && number >= 1 && number <= limit
  if (key === quotaKey ? !within(quota.per_user_daily, quota.site_daily) || !within(quota.site_daily, 1000000) :
    !within(retention.download_hours, 8760) || !within(retention.export_hours, 8760)) return
  emit('save', policy, { ...value })
}
</script>

<template>
  <a-card v-if="policies.length" title="工具策略">
    <a-form :model="quota" layout="vertical" @finish="save(quotaKey)">
      <a-form-item label="每人每日搜索次数" html-for="search-quota-user" extra="按北京时间自然日计算。">
        <a-input-number id="search-quota-user" v-model:value="quota.per_user_daily" :min="1" :max="quota.site_daily" :precision="0" :disabled="busy" />
      </a-form-item>
      <a-form-item label="全站每日搜索次数" html-for="search-quota-site">
        <a-input-number id="search-quota-site" v-model:value="quota.site_daily" :min="1" :max="1000000" :precision="0" :disabled="busy" />
      </a-form-item>
      <a-button html-type="submit" :disabled="busy || !quota.per_user_daily || quota.site_daily < quota.per_user_daily">保存搜索额度</a-button>
    </a-form>
    <a-divider />
    <a-form :model="retention" layout="vertical" @finish="save(retentionKey)">
      <a-form-item label="下载保留时间（小时）" html-for="download-retention">
        <a-input-number id="download-retention" v-model:value="retention.download_hours" :min="1" :max="8760" :precision="0" :disabled="busy" />
      </a-form-item>
      <a-form-item label="导出保留时间（小时）" html-for="export-retention" extra="修改后仅影响后续接纳的运行。">
        <a-input-number id="export-retention" v-model:value="retention.export_hours" :min="1" :max="8760" :precision="0" :disabled="busy" />
      </a-form-item>
      <a-button html-type="submit" :disabled="busy || !retention.download_hours || !retention.export_hours">保存保留时间</a-button>
    </a-form>
  </a-card>
</template>
