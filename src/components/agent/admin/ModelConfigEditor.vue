<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { agentModelApi } from '@/api/agentModelAdmin'
import type { ModelConfig, ModelInput } from '@/features/agent/chat/model'

/** 编辑器管理未保存凭据和表单；不回填或持久化已保存密钥。 */
const props = defineProps<{ open: boolean; config?: ModelConfig }>()
const emit = defineEmits<{ close: []; saved: [config: ModelConfig]; uncertain: [] }>()
const formRef = shallowRef<{ validate: () => Promise<void> }>() // Ant 表单校验边界。
const form = reactive<ModelInput>({ name: '', provider: 'deepseek', model: '', thinking_enabled: false, max_output_tokens: 8192, context_budget_tokens: 32768, revision: 0 })
const key = shallowRef('') // 明文仅在本对话框输入期间存在。
const replaceKey = shallowRef(false) // 区分保留原密钥与显式替换。
const busy = shallowRef(false) // 请求未结束时防止重复写入。
const error = shallowRef('') // 修订号冲突时保留已填写草稿。
const requireKey = computed(() => !props.config || replaceKey.value)
const rules = { name: [{ required: true, message: '请输入配置名称' }], model: [{ required: true, message: '请输入账户实际可用的模型名称' }] }

/** 仅在明确打开另一记录时重置；列表刷新不覆盖已打开草稿。 */
watch(() => props.open, open => {
  if (!open) { key.value = ''; return }
  const c = props.config
  Object.assign(form, { name: c?.name ?? '', provider: 'deepseek', model: c?.model ?? '', thinking_enabled: c?.thinking_enabled ?? false, max_output_tokens: c?.max_output_tokens ?? 8192, context_budget_tokens: c?.context_budget_tokens ?? 32768, revision: c?.revision ?? 0 })
  key.value = ''; replaceKey.value = false; error.value = ''
})

/** 仅提交一次保存；结果不确定时由父组件重读权威元数据，不重复变更。 */
async function save(): Promise<void> {
  try { await formRef.value?.validate() } catch { return }
  if (requireKey.value && !key.value.trim()) { error.value = '请输入新的 API Key；已有密钥可选择保留'; return }
  if (form.context_budget_tokens < form.max_output_tokens + 1024) { error.value = '上下文预算至少比输出预算多 1024'; return }
  busy.value = true; error.value = ''
  try {
    const input = { ...form }
    if (requireKey.value) input.api_key = key.value
    const saved = await agentModelApi.save(props.config?.id, input)
    key.value = ''; emit('saved', saved)
  } catch (cause) {
    error.value = `${cause instanceof Error ? cause.message : '保存失败'}。请核对刷新后的列表，当前表单已保留；不要直接重复创建。`
    emit('uncertain')
  } finally { busy.value = false }
}
</script>

<template>
  <a-modal :open="open" :title="config ? '编辑模型配置' : '新建模型配置'" :confirm-loading="busy" :mask-closable="!busy" :closable="!busy" :cancel-button-props="{ disabled: busy }" @cancel="emit('close')" @ok="save">
    <a-alert v-if="error" type="error" show-icon :message="error" class="form-error" />
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="配置名称" name="name"><a-input v-model:value="form.name" :maxlength="120" /></a-form-item>
      <a-form-item label="厂商与官方地址"><a-input value="DeepSeek · https://api.deepseek.com/" readonly /></a-form-item>
      <a-form-item label="模型名称" name="model" extra="按账户当前可用模型填写；保存后可执行真实生成测试。"><a-input v-model:value="form.model" :maxlength="128" /></a-form-item>
      <a-form-item label="深度思考"><a-switch v-model:checked="form.thinking_enabled" checked-children="开启" un-checked-children="关闭" /></a-form-item>
      <a-form-item v-if="config" label="密钥处理"><a-radio-group v-model:value="replaceKey"><a-radio :value="false">保留原密钥</a-radio><a-radio :value="true">替换密钥</a-radio></a-radio-group></a-form-item>
      <a-form-item v-if="requireKey" label="新的 API Key" required extra="仅用于本次保存，不回填已保存内容。"><a-input-password v-model:value="key" autocomplete="new-password" :maxlength="4096" /></a-form-item>
      <details class="advanced"><summary>高级预算设置</summary><a-form-item label="单次输出预算"><a-input-number v-model:value="form.max_output_tokens" :min="1" :max="32768" :precision="0" /></a-form-item><a-form-item label="完整请求项目预算" extra="包含历史、当前输入、输出预留和安全余量；这是项目预算。"><a-input-number v-model:value="form.context_budget_tokens" :min="form.max_output_tokens + 1024" :max="131072" :precision="0" /></a-form-item></details>
    </a-form>
  </a-modal>
</template>

<style scoped>
.form-error { margin-bottom: 20px; }.advanced summary { cursor: pointer; padding: 8px 0 16px; }.advanced :deep(.ant-input-number) { width: 100%; }
</style>
