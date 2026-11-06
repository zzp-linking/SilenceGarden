<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { agentIndexAdminApi } from '@/api/agentIndexAdmin'
import { useKnowledgePage } from '@/composables/agent/useKnowledgePage'
import { useIndexRuntime } from '@/composables/agent/useIndexRuntime'
import { useIndexPolling } from '@/composables/agent/useIndexPolling'
import IndexRuntimeStatus from '@/components/agent/admin/IndexRuntimeStatus.vue'
import IndexJobCounts from '@/components/agent/admin/IndexJobCounts.vue'
import IndexJobDetail from '@/components/agent/admin/IndexJobDetail.vue'
import KnowledgePager from '@/components/agent/admin/KnowledgePager.vue'
/** route：当前管理员路由，复用页面时须响应参数变化。 */
const route = useRoute()
/** jobId：路由当前选中的任务 ID；为空时仅展示任务列表。 */
const jobId = computed(() => String(route.params.jobId || ''))
/** runtime：当前页面的索引运行快照及只读刷新能力。 */
const runtime = useIndexRuntime()
/** page：当前面板独占的游标读取状态，筛选变化后从首页重新加载。 */
const page = useKnowledgePage((cursor, signal) => agentIndexAdminApi.jobs({ cursor }, signal))
/** columns：表格列定义，业务事实由各行的服务端数据提供。 */
const columns = [{ title: '提交时间 / 意图', key: 'job' }, { title: '逐篇统计', key: 'counts' }, { title: '详情', key: 'actions' }]
useIndexPolling(() => page.data.value.items.some(job => job.counts.queued + job.counts.running > 0) || !!runtime.state.value && runtime.state.value.queued + runtime.state.value.running > 0, async () => { if (!page.loading.value) await page.reload() })
/** submitted 新任务提交后同步刷新运行状态与任务列表。 */
function submitted() { void runtime.reload(); void page.reload() }
void page.first()
</script>
<template>
  <section class="admin-page" aria-label="知识索引任务"><header class="admin-page-head"><div><h1 class="admin-page-title">索引任务</h1><p class="admin-page-description">从持久化快照恢复逐篇事实，页面关闭不取消任务。</p></div><RouterLink to="/admin/agent/knowledge-bases">管理知识库</RouterLink></header><IndexRuntimeStatus :state="runtime.state.value" :loading="runtime.loading.value" :error="runtime.error.value" @refresh="runtime.reload" /><a-card title="提交记录" :bordered="false"><template #extra><a-button :loading="page.loading.value" @click="page.first">刷新任务列表</a-button></template><a-alert v-if="page.error.value" type="error" show-icon :message="page.error.value" /><a-table row-key="id" :columns="columns" :data-source="page.data.value.items" :loading="page.loading.value" :pagination="false" :scroll="{ x: 680 }"><template #bodyCell="{ column, record }"><template v-if="column.key === 'job'"><p>{{ new Date(record.created_at).toLocaleString() }}</p><a-tag>{{ record.mode === 'force' ? '强制重建' : '建立索引' }}</a-tag></template><IndexJobCounts v-else-if="column.key === 'counts'" :counts="record.counts" /><RouterLink v-else-if="column.key === 'actions'" :to="`/admin/agent/index-jobs/${record.id}`">查看逐篇结果</RouterLink></template></a-table><KnowledgePager :previous="page.canPrevious.value" :next="!!page.data.value.next_cursor" :busy="page.loading.value" :page="page.index.value" @previous="page.previous" @next="page.next" /></a-card><IndexJobDetail v-if="jobId" :key="jobId" :job-id="jobId" :accepting="!!runtime.state.value?.accepting" @submitted="submitted" /></section>
</template>
