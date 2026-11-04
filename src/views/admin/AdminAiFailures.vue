<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import type { FailureLog } from '@/types/admin'
import { formatAdminTime } from '@/utils/adminDisplay'
import { adminApi } from '@/api/admin'
import { useAdminCursorPage } from '@/composables/useAdminResource'
const page = useAdminCursorPage(options => adminApi.failures(options))
const { data, loading, error, index } = page
const rows = computed(() => data.value?.items || [])
const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'time', width: 200 },
  { title: '错误码', dataIndex: 'error_code', key: 'code', width: 210 },
  { title: '阶段', dataIndex: 'stage', width: 120 },
  { title: '模型', dataIndex: 'model', width: 230 },
  { title: '可重试', key: 'retryable', width: 100 },
  { title: '供应商 Request ID', dataIndex: 'provider_request_id', key: 'provider', width: 240 },
  { title: '本地 Request ID', dataIndex: 'request_id', key: 'request', width: 240 }
]
onMounted(page.first)
</script>
<template>
  <section class="admin-page">
    <header class="admin-page-head"><div><h1 class="admin-page-title">失败日志</h1><p class="admin-page-description">查看模型请求的错误码、失败阶段与追踪标识。</p></div><a-button :loading="loading" @click="page.reload"><template #icon><ReloadOutlined /></template>刷新</a-button></header>
    <a-alert type="info" show-icon message="仅展示运行元数据，不包含提问、回答、图片或供应商原始响应。" />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-card :bordered="false">
      <a-table :columns="columns" :data-source="rows" :row-key="(item: FailureLog) => item.request_id + '-' + item.created_at" :loading="loading" :pagination="false" :scroll="{ x: 1340 }">
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'time'">{{ formatAdminTime(record.created_at) }}</template>
          <template v-else-if="column.key === 'code'"><a-tag color="error">{{ text }}</a-tag></template>
          <template v-else-if="column.key === 'retryable'"><a-tag :color="record.retryable ? 'blue' : 'default'">{{ record.retryable ? '是' : '否' }}</a-tag></template>
          <template v-else-if="column.key === 'request' || column.key === 'provider'"><a-typography-text v-if="text" copyable class="admin-mono">{{ text }}</a-typography-text><span v-else>—</span></template>
        </template>
      </a-table>
      <div class="admin-pagination"><span class="admin-muted">第 {{ index + 1 }} 页</span><a-button :disabled="index === 0 || loading" @click="page.previous">上一页</a-button><a-button :disabled="!data?.next_cursor || loading" @click="page.next">下一页</a-button></div>
    </a-card>
  </section>
</template>
