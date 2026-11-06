<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { agentAdminApi, type KnowledgeBase } from '@/api/agentAdmin'
import { knowledgeError, useKnowledgePage } from '@/composables/agent/useKnowledgePage'
import BaseEditor from '@/components/agent/admin/BaseEditor.vue'
import KnowledgePager from '@/components/agent/admin/KnowledgePager.vue'
/** page：当前面板独占的游标读取状态，筛选变化后从首页重新加载。 */
const page = useKnowledgePage(cursor => agentAdminApi.bases({ cursor }))
/** editing：是否显示元数据编辑表单。 */
const editing = shallowRef(false)
/** selected：当前编辑或批量提交的选择快照，实际提交时仍由后端校验。 */
const selected = shallowRef<KnowledgeBase | null>(null)
/** busy：当前读取或写入动作是否进行中，用于阻止重复交互。 */
const busy = shallowRef(false)
/** error：当前资源或操作的可读错误，不把依赖故障显示成零命中。 */
const error = shallowRef('')
onMounted(page.first)
/**
 * edit 固定当前编辑资源的快照并打开表单；空选择表示新建。
 * @param value 需要编辑的当前资源快照；null 表示新建。
 */
function edit(value: KnowledgeBase | null) { selected.value = value; editing.value = true }
/**
 * remove 携带元数据修订删除空知识库，失败时保留服务器冲突提示。
 * @param value 需要校验、保存或操作的当前数据快照。
 */
async function remove(value: KnowledgeBase) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await agentAdminApi.removeBase(value); await page.first() }
  catch (reason) { error.value = knowledgeError(reason) }
  finally { busy.value = false }
}
// 保存完成后从首页重新读取，避免新建项被旧游标隐藏。
function saved() { editing.value = false; void page.first() }
</script>
<template>
  <section class="admin-page" aria-label="知识库管理">
    <header class="admin-page-head"><div><h1 class="admin-page-title">知识库</h1><p class="admin-page-description">组织学习资料、合集与固定原文件。</p></div><a-space wrap><a-button :loading="page.loading.value" :disabled="busy" @click="page.first">刷新列表</a-button><a-button type="primary" :disabled="busy" @click="edit(null)">创建知识库</a-button></a-space></header>
    <a-alert type="info" show-icon message="原文件与知识资料" description="上传后请在知识库详情中显式建立索引，再查看任务和检索结果。原文件固定保存，上传不会自动开始索引。" />
    <a-alert v-if="error || page.error.value" role="alert" type="error" show-icon :message="error || page.error.value" />
    <a-card :bordered="false">
      <a-list class="knowledge-list" :loading="page.loading.value" :data-source="page.data.value.items" :locale="{ emptyText: '还没有知识库，创建一个开始整理资料' }">
        <template #renderItem="{ item }"><a-list-item><a-list-item-meta :description="item.description || '暂无说明'"><template #title><RouterLink :to="`/admin/agent/knowledge-bases/${item.id}`">{{ item.name }}</RouterLink></template></a-list-item-meta><template #actions><a-tag>修订 {{ item.revision }}</a-tag><a-button :disabled="busy" @click="edit(item)">编辑</a-button><a-popconfirm title="仅空知识库可删除，历史删除文档及文件仍保留。" ok-text="删除知识库" cancel-text="取消" @confirm="remove(item)"><a-button danger :disabled="busy">删除</a-button></a-popconfirm></template></a-list-item></template>
      </a-list>
      <KnowledgePager :previous="page.canPrevious.value" :next="!!page.data.value.next_cursor" :busy="busy || page.loading.value" :page="page.index.value" @previous="page.previous" @next="page.next" />
    </a-card>
    <BaseEditor v-if="editing" :parent="null" :existing="selected" @saved="saved" @cancel="editing = false; page.first()" />
  </section>
</template>
<style scoped>
.knowledge-list :deep(.ant-list-item-meta) { min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .knowledge-list :deep(.ant-list-item) { flex-wrap: wrap; gap: 12px; }
  .knowledge-list :deep(.ant-list-item-meta) { flex: 1 1 100%; }
  .knowledge-list :deep(.ant-list-item-action) { margin-inline-start: 0; }
}
</style>
