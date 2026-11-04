<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import type { AuditLog } from '@/types/admin'
import { formatAdminTime } from '@/utils/adminDisplay'
import { adminApi } from '@/api/admin'
import { useAdminCursorPage } from '@/composables/useAdminResource'
const page = useAdminCursorPage(options => adminApi.auditLogs(options))
const { data, loading, error, index } = page
const rows = computed(() => data.value?.items || [])
const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'time', width: 200 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 220 },
  { title: '目标', key: 'target', width: 240 },
  { title: 'Request ID', dataIndex: 'request_id', key: 'request', width: 240 },
  { title: '变更字段', key: 'changes', width: 260 }
]
onMounted(page.first)
</script>
<template>
  <section class="admin-page">
    <header class="admin-page-head"><div><h1 class="admin-page-title">审计日志</h1><p class="admin-page-description">追踪管理员操作与配置变更。</p></div><a-button :loading="loading" @click="page.reload"><template #icon><ReloadOutlined /></template>刷新</a-button></header>
    <a-alert type="info" show-icon message="仅展示变更元数据，不包含密码、API Key、提问、回答或图片内容。" />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-card :bordered="false">
      <a-table :columns="columns" :data-source="rows" :row-key="(item: AuditLog) => item.request_id + '-' + item.created_at + '-' + item.action + '-' + (item.target_id || '')" :loading="loading" :pagination="false" :scroll="{ x: 1160 }">
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'time'">{{ formatAdminTime(record.created_at) }}</template>
          <template v-else-if="column.key === 'action'"><a-tag>{{ text }}</a-tag></template>
          <template v-else-if="column.key === 'target'">{{ record.target_type }}<div v-if="record.target_id" class="admin-muted admin-mono">{{ record.target_id }}</div></template>
          <template v-else-if="column.key === 'request'"><a-typography-text copyable class="admin-mono">{{ text }}</a-typography-text></template>
          <template v-else-if="column.key === 'changes'"><a-space v-if="record.changes?.length" wrap :size="[4, 4]"><a-tag v-for="change in record.changes" :key="change.field">{{ change.field }}</a-tag></a-space><span v-else>—</span></template>
        </template>
      </a-table>
      <div class="admin-pagination"><span class="admin-muted">第 {{ index + 1 }} 页</span><a-button :disabled="index === 0 || loading" @click="page.previous">上一页</a-button><a-button :disabled="!data?.next_cursor || loading" @click="page.next">下一页</a-button></div>
    </a-card>
  </section>
</template>
