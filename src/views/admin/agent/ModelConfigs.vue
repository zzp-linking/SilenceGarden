<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import ModelConfigEditor from '@/components/agent/admin/ModelConfigEditor.vue'
import { agentModelApi } from '@/api/agentModelAdmin'
import type { ModelConfig, ModelTestResult } from '@/features/agent/chat/model'

/** 页面管理已保存元数据和列表操作；编辑器独立维护未保存表单及密钥。 */
const rows = shallowRef<ModelConfig[]>([]) // 以服务端为准的配置列表。
const selected = shallowRef<ModelConfig>() // 当前编辑记录，不包含密文。
const open = shallowRef(false) // 编辑器是否显示。
const busy = shallowRef(false) // 串行控制本页变更及测试操作。
const loading = shallowRef(false) // 独立的元数据刷新状态。
const known = shallowRef(false) // 区分列表读取失败与已确认全部停用，避免误报。
const error = shallowRef('') // 可安全展示的 V2 错误文案。
const result = shallowRef<ModelTestResult>() // 供应商输出通道的实际观测结果。
const active = computed(() => rows.value.find(c => c.enabled))
const columns = [{ title: '名称 / 模型', key: 'name' }, { title: '模式', key: 'mode' }, { title: '状态 / 密钥', key: 'status' }, { title: '更新时间', key: 'time' }, { title: '操作', key: 'actions' }]

/** 读取当前保存状态；读取失败不丢弃已打开的编辑草稿。 */
async function load(): Promise<void> { loading.value = true; try { rows.value = (await agentModelApi.list()).items; known.value = true } catch (cause) { known.value = false; error.value = cause instanceof Error ? cause.message : '配置列表暂不可用' } finally { loading.value = false } }
/** 明确打开编辑草稿，不回填密钥原文或遮罩值。 */
function edit(config?: ModelConfig): void { selected.value = config; open.value = true }
/** 区分测试与启用反馈；每次变更后均重读列表，包括结果不确定的失败。 */
async function action(config: ModelConfig, operation: 'activate' | 'deactivate' | 'delete' | 'test'): Promise<void> {
  busy.value = true; error.value = ''; result.value = undefined
  try { if (operation === 'test') result.value = await agentModelApi.test(config); else await agentModelApi.change(config, operation) }
  catch (cause) { error.value = `${cause instanceof Error ? cause.message : '操作失败'}；已重新读取列表，请核对实际结果。` }
  finally { await load(); busy.value = false }
}
/** 保存确认成功后先关闭密钥输入，再刷新元数据。 */
function saved(): void { open.value = false; void load() }
onMounted(load)
</script>

<template>
  <section class="admin-page">
    <div class="admin-page-head"><div><h1 class="admin-page-title">模型配置</h1><p class="admin-page-description">维护 DeepSeek 凭据与模式。每次新发送使用当前启用配置，已运行的回答保持原快照。</p></div><a-space><RouterLink to="/agent/chat">打开智能体</RouterLink><a-button :loading="loading" @click="load">刷新</a-button><a-button type="primary" :disabled="busy" @click="edit()">新建配置</a-button></a-space></div>
    <a-alert :type="active && known ? 'info' : 'warning'" show-icon :message="!known ? '配置状态尚未读取成功，请刷新核对' : active ? `当前启用：${active.name} · ${active.model} · ${active.thinking_enabled ? '深度思考' : '普通模式'}` : '当前全部停用，智能体暂不可发送'" />
    <a-alert v-if="error" type="error" show-icon :message="error" closable @close="error = ''" />
    <a-alert v-if="result" :type="result.success ? 'success' : 'warning'" show-icon :message="result.reason" :description="`耗时 ${result.duration_ms} ms；思考通道：${result.saw_reasoning ? '已观测' : '未观测'}；回答通道：${result.saw_answer ? '已观测' : '未观测'}`" />
    <a-card :bordered="false"><a-table :columns="columns" :data-source="rows" row-key="id" :pagination="false" :loading="loading" :scroll="{ x: 900 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'"><strong>{{ record.name }}</strong><div class="admin-muted">DeepSeek · {{ record.model }}</div><small class="admin-muted">修订 {{ record.revision }}</small></template>
        <template v-else-if="column.key === 'mode'">{{ record.thinking_enabled ? '深度思考' : '普通' }}</template>
        <template v-else-if="column.key === 'status'"><a-tag :color="record.enabled ? 'blue' : 'default'">{{ record.enabled ? '启用' : '停用' }}</a-tag><div>{{ record.has_api_key ? record.credential_available ? '密钥已配置' : '凭据不可用，请替换或修复部署密钥' : '未配置密钥' }}</div></template>
        <template v-else-if="column.key === 'time'">{{ new Date(record.updated_at).toLocaleString() }}</template>
        <template v-else-if="column.key === 'actions'"><a-space wrap><a-button size="small" :disabled="busy" @click="edit(record)">编辑</a-button><a-button size="small" :disabled="busy || !record.credential_available" @click="action(record, 'test')">测试</a-button><a-button size="small" :disabled="busy || (!record.enabled && !record.credential_available)" @click="action(record, record.enabled ? 'deactivate' : 'activate')">{{ record.enabled ? '停用' : '启用' }}</a-button><a-popconfirm title="删除此停用配置？" :disabled="record.enabled || busy" @confirm="action(record, 'delete')"><a-button size="small" danger :disabled="record.enabled || busy">删除</a-button></a-popconfirm></a-space></template>
      </template>
    </a-table></a-card>
    <ModelConfigEditor :open="open" :config="selected" @close="open = false" @saved="saved" @uncertain="load" />
  </section>
</template>
