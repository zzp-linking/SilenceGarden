<script setup lang="ts">
import { reactive, shallowRef, watch } from 'vue'
import { mcpServerAdmin, type McpCallLog } from '@/api/agentMcpServerAdmin'
import { mcpLocalTime, useMcpServerPage } from '@/composables/useMcpServerPage'

const props = defineProps<{ selectedKeyId: string }>() // 由 Key 列表指定的日志筛选项。
const { items, loading, error, previous, nextCursor, search, refresh, next, back } = useMcpServerPage(mcpServerAdmin.logs)
const filters = reactive({ key: '', tool: '', from: '', to: '' }) // 当前筛选输入。
const formError = shallowRef('') // 过滤区间的本地校验错误。
const statusLabels = { succeeded: '成功', failed: '失败', rejected: '已拒绝', timed_out: '超时', canceled: '已取消' }
const statusColors = { succeeded: 'green', failed: 'red', rejected: 'orange', timed_out: 'orange', canceled: 'default' }

/** 将本地时间转为 RFC 3339，并在请求前核对范围。 */
function applyFilters() {
  const from = filters.from ? new Date(filters.from) : undefined
  const to = filters.to ? new Date(filters.to) : undefined
  if (from && !Number.isFinite(from.getTime()) || to && !Number.isFinite(to.getTime()) || from && to && from > to) {
    formError.value = '请核对日志查询的起止时间。'
    return
  }
  formError.value = ''
  return search({ api_key_id: filters.key.trim(), tool_name: filters.tool.trim(), from: from?.toISOString(), to: to?.toISOString() })
}

watch(() => props.selectedKeyId, key => {
  filters.key = key
  void applyFilters()
}, { immediate: true })
</script>

<template>
  <a-card size="small" title="调用日志">
    <a-form class="log-filters" layout="inline" @finish="applyFilters">
      <a-form-item label="Key ID" html-for="mcp-log-key">
        <a-input id="mcp-log-key" v-model:value="filters.key" allow-clear />
      </a-form-item>
      <a-form-item label="工具名" html-for="mcp-log-tool">
        <a-input id="mcp-log-tool" v-model:value="filters.tool" allow-clear />
      </a-form-item>
      <a-form-item label="起始时间" html-for="mcp-log-from">
        <a-input id="mcp-log-from" v-model:value="filters.from" type="datetime-local" />
      </a-form-item>
      <a-form-item label="结束时间" html-for="mcp-log-to">
        <a-input id="mcp-log-to" v-model:value="filters.to" type="datetime-local" />
      </a-form-item>
      <a-button html-type="submit" :loading="loading">筛选</a-button>
    </a-form>
    <a-alert v-if="formError || error" class="log-alert" type="error" show-icon :message="formError || error" />
    <a-table :data-source="items" :pagination="false" :loading="loading" :scroll="{ x: 1050 }" row-key="id" size="small"
      :locale="{ emptyText: '暂无调用记录' }">
      <a-table-column title="开始时间" key="start">
        <template #default="{ record }: { record: McpCallLog }">{{ mcpLocalTime(record.started_at) }}</template>
      </a-table-column>
      <a-table-column title="Key / 工具" key="tool">
        <template #default="{ record }: { record: McpCallLog }">
          <div>{{ record.key_title }} · {{ record.service_name }}</div><code>{{ record.tool_name }}</code>
        </template>
      </a-table-column>
      <a-table-column title="状态" key="status">
        <template #default="{ record }: { record: McpCallLog }">
          <a-tag :color="statusColors[record.status]">{{ statusLabels[record.status] }}</a-tag>
          <div v-if="record.error_code"><code>{{ record.error_code }}</code></div>
        </template>
      </a-table-column>
      <a-table-column title="耗时 / 结果" key="duration">
        <template #default="{ record }: { record: McpCallLog }">
          {{ record.duration_ms }} ms <span v-if="record.result_count !== null">· {{ record.result_count }} 条</span>
        </template>
      </a-table-column>
      <a-table-column title="知识库 ID" key="base">
        <template #default="{ record }: { record: McpCallLog }"><code>{{ record.knowledge_base_id ?? '—' }}</code></template>
      </a-table-column>
      <a-table-column title="请求 ID" key="request">
        <template #default="{ record }: { record: McpCallLog }"><code>{{ record.request_id }}</code></template>
      </a-table-column>
    </a-table>
    <a-space class="log-pages">
      <a-button :disabled="loading || !previous.length" @click="back">上一页</a-button>
      <a-button :disabled="loading || !nextCursor" @click="next">下一页</a-button>
      <a-button :loading="loading" @click="refresh">刷新</a-button>
    </a-space>
  </a-card>
</template>

<style scoped>
.log-filters { row-gap: 8px; margin-bottom: 16px; }
.log-alert { margin-bottom: 12px; }
.log-pages { margin-top: 16px; }
</style>

