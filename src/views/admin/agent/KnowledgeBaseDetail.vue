<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { agentAdminApi, type KnowledgeBase } from '@/api/agentAdmin'
import { knowledgeError } from '@/composables/agent/useKnowledgePage'
import BaseEditor from '@/components/agent/admin/BaseEditor.vue'
import BookManager from '@/components/agent/admin/BookManager.vue'
import DocumentPanel from '@/components/agent/admin/DocumentPanel.vue'
import IndexRuntimeStatus from '@/components/agent/admin/IndexRuntimeStatus.vue'
import KnowledgeSearch from '@/components/agent/admin/KnowledgeSearch.vue'
import { useIndexRuntime } from '@/composables/agent/useIndexRuntime'
/** route：当前管理员路由，复用页面时须响应参数变化。 */
const route = useRoute()
/** baseId：当前路由知识库 ID，所有子面板读取均限定在此范围。 */
const baseId = computed(() => String(route.params.id))
/** base：当前知识库的最新元数据快照。 */
const base = shallowRef<KnowledgeBase | null>(null)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
/** loading：当前读取请求的加载状态，仅允许最新请求更新。 */
const loading = shallowRef(false)
/** editing：是否显示元数据编辑表单。 */
const editing = shallowRef(false)
/** refreshKey：元数据或 Book 成员变化后的刷新代号，通知子面板重置失效筛选。 */
const refreshKey = shallowRef(0)
/** activityKey：索引操作完成后的刷新代号，用于同步 Book 忙碌状态与文档摘要。 */
const activityKey = shallowRef(0)
/** runtime：当前页面的索引运行快照及只读刷新能力。 */
const runtime = useIndexRuntime()
/** indexActive：是否仍有 queued/running 工作，决定相关面板是否继续轮询。 */
const indexActive = computed(() => !!runtime.state.value && runtime.state.value.queued + runtime.state.value.running > 0)
/** indexed 索引动作完成后通知父级刷新运行状态与相关列表。 */
function indexed() { activityKey.value++; void runtime.reload() }
// 路由复用时失效旧响应，防止把 A 库名称显示在 B 库操作页面。
watch(baseId, async (value, _old, onCleanup) => {
  let current = true; onCleanup(() => { current = false })
  base.value = null; error.value = ''; loading.value = true; editing.value = false
  try { const result = await agentAdminApi.base(value); if (current) base.value = result }
  catch (reason) { if (current) error.value = knowledgeError(reason) }
  finally { if (current) loading.value = false }
}, { immediate: true })
/**
 * saved 用保存成功返回的最新快照更新知识库，并关闭编辑器。
 * @param value 需要校验、保存或操作的当前数据快照。
 */
function saved(value: KnowledgeBase) { base.value = value; editing.value = false }
/** refresh 重新读取当前知识库；路由已切换时丢弃结果，成功后通知子列表刷新。 */
async function refresh() {
  error.value = ''; loading.value = true
  const value = baseId.value
  try { const result = await agentAdminApi.base(value); if (value === baseId.value) { base.value = result; refreshKey.value++ } }
  catch (reason) { if (value === baseId.value) error.value = knowledgeError(reason) }
  finally { if (value === baseId.value) loading.value = false }
}
</script>
<template>
  <section class="admin-page" aria-label="知识库内容管理">
    <header class="admin-page-head"><div><RouterLink to="/admin/agent/knowledge-bases">返回知识库</RouterLink><h1 class="admin-page-title">{{ base?.name || '知识库详情' }}</h1><p class="admin-page-description">{{ base?.description || '维护 Book、文档归属与固定来源' }}</p></div><a-space wrap><a-tag v-if="base">修订 {{ base.revision }}</a-tag><a-button :loading="loading" @click="refresh">刷新</a-button><a-button :disabled="!base || loading" @click="editing = true">编辑知识库</a-button></a-space></header>
    <a-alert v-if="error" role="alert" type="error" show-icon :message="error" />
    <a-alert type="info" show-icon message="原文件固定保存，删除后重新上传会创建新文档与新资产。上传成功不表示已可检索。" />
    <template v-if="base">
      <IndexRuntimeStatus :state="runtime.state.value" :loading="runtime.loading.value" :error="runtime.error.value" @refresh="runtime.reload" />
      <!-- Keep validation reachable without scrolling past twenty document rows. -->
      <a-tabs :key="baseId" default-active-key="content">
        <a-tab-pane key="content" tab="Book 与文档"><div class="content-panels"><BookManager :key="baseId" :base-id="baseId" :accepting="!!runtime.state.value?.accepting" :active="indexActive" :activity-key="activityKey" @changed="refreshKey++" @indexed="indexed" /><DocumentPanel :key="baseId" :base-id="baseId" :refresh-key="refreshKey" :activity-key="activityKey" :runtime="runtime.state.value" @indexed="indexed" /></div></a-tab-pane>
        <a-tab-pane key="search" tab="检索验证"><KnowledgeSearch :key="`${baseId}-search`" :base-id="baseId" :ready="!!runtime.state.value?.retrieval_ready" :refresh-key="refreshKey" /></a-tab-pane>
      </a-tabs>
    </template>
    <a-spin v-else-if="loading" />
    <BaseEditor v-if="editing && base" :parent="null" :existing="base" @saved="saved" @cancel="editing = false; refresh()" />
  </section>
</template>
<style scoped>.content-panels { display: grid; gap: 24px; }</style>
