<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import type { AiSettings, ScopeQuota } from '@/types/admin'
import { integerField, microCnyToYuan, yuanToMicroCny } from '@/utils/microCny'

type PriceDraft = {
  input_cache_hit: string
  input_cache_miss: string
  output: string
}

type QuotaDraft = Omit<ScopeQuota, 'daily_micro_cny'> & { daily_micro_cny_yuan: string }
type QuotaDrafts = { [key in keyof AiSettings['quotas']]: QuotaDraft }

type SettingsDraft = {
  service: AiSettings['service']
  quotas: QuotaDrafts
  limits: AiSettings['limits'] & { allowed_image_mimes_text: string }
  images: AiSettings['images']
  models: AiSettings['models'] & { allowlist_text: string }
  pricing: Omit<AiSettings['pricing'], 'models' | 'exchange_rate_micros' | 'safety_margin_micros'> & {
    exchange_rate_yuan: string
    safety_margin_yuan: string
    models: Record<string, PriceDraft>
  }
  moderation: AiSettings['moderation']
  retention: AiSettings['retention']
  starters: [string, string, string, string]
}

const props = defineProps<{ settings: AiSettings; busy?: boolean }>()
const emit = defineEmits<{ save: [settings: AiSettings] }>()
const localError = shallowRef('')

const quotaConcurrentMaximum: Record<keyof AiSettings['quotas'], number> = {
  global: 16,
  account_default: 3,
  anonymous_ip: 8,
  anonymous_device: 8
}

function quotaConcurrentMax(scope: keyof AiSettings['quotas']): number {
  return quotaConcurrentMaximum[scope]
}

function cloneJson<T>(value: T): T {
  // 设置对象仅含 JSON 数据，深拷贝可阻止表单直接修改父组件传入值。
  return JSON.parse(JSON.stringify(value)) as T
}

/** 将服务端设置复制为表单草稿，并补全可编辑的模型价格项。 */
function toDraft(settings: AiSettings): SettingsDraft {
  const models: Record<string, PriceDraft> = {}
  const quotas = Object.fromEntries(Object.entries(settings.quotas).map(([name, quota]) => [name, {
    daily_micro_cny_yuan: microCnyToYuan(quota.daily_micro_cny),
    daily_rounds: quota.daily_rounds,
    max_concurrent: quota.max_concurrent,
    requests_per_minute: quota.requests_per_minute
  }])) as QuotaDrafts
  for (const [model, price] of Object.entries(settings.pricing.models)) {
    models[model] = {
      input_cache_hit: microCnyToYuan(price.input_cache_hit_peak_micro_cny_per_million),
      input_cache_miss: microCnyToYuan(price.input_cache_miss_peak_micro_cny_per_million),
      output: microCnyToYuan(price.output_peak_micro_cny_per_million)
    }
  }
  return {
    service: cloneJson(settings.service),
    quotas,
    limits: { ...cloneJson(settings.limits), allowed_image_mimes_text: settings.limits.allowed_image_mimes.join('\n') },
    images: cloneJson(settings.images),
    models: { ...cloneJson(settings.models), allowlist_text: settings.models.allowlist.join('\n') },
    pricing: {
      version: settings.pricing.version,
      effective_at: settings.pricing.effective_at,
      exchange_rate_yuan: microCnyToYuan(settings.pricing.exchange_rate_micros),
      safety_margin_yuan: microCnyToYuan(settings.pricing.safety_margin_micros),
      models
    },
    moderation: cloneJson(settings.moderation),
    retention: cloneJson(settings.retention),
    starters: [...settings.starters] as SettingsDraft['starters']
  }
}

const draft = reactive<SettingsDraft>(toDraft(props.settings))
watch(() => props.settings, value => Object.assign(draft, toDraft(value)))

const priceModels = computed(() => Array.from(new Set([...draft.models.allowlist_text.split(/[\n,]/).map(item => item.trim()).filter(Boolean), ...Object.keys(props.settings.pricing.models)])))

function ensurePrice(model: string): PriceDraft {
  // allowlist 新增模型时先创建空价格行，避免模板访问 undefined。
  if (!draft.pricing.models[model]) draft.pricing.models[model] = { input_cache_hit: '0', input_cache_miss: '0', output: '0' }
  return draft.pricing.models[model]
}


/** 把可能含临时字段的表单草稿收敛回服务端接受的完整设置。 */
function buildSettings(): AiSettings {
  const allowlist = draft.models.allowlist_text.split(/[\n,]/).map(item => item.trim()).filter(Boolean)
  const prices: AiSettings['pricing']['models'] = {}
  for (const model of priceModels.value) {
    const price = ensurePrice(model)
    prices[model] = {
      input_cache_hit_peak_micro_cny_per_million: yuanToMicroCny(price.input_cache_hit),
      input_cache_miss_peak_micro_cny_per_million: yuanToMicroCny(price.input_cache_miss),
      output_peak_micro_cny_per_million: yuanToMicroCny(price.output)
    }
  }
  const { allowed_image_mimes_text, ...limitValues } = draft.limits
  const quotas = Object.fromEntries(Object.entries(draft.quotas).map(([name, quota]) => [name, {
    daily_micro_cny: yuanToMicroCny(quota.daily_micro_cny_yuan),
    daily_rounds: quota.daily_rounds,
    max_concurrent: quota.max_concurrent,
    requests_per_minute: quota.requests_per_minute
  }])) as AiSettings['quotas']
  return {
    id: 'global', revision: props.settings.revision, updated_by: props.settings.updated_by, updated_at: props.settings.updated_at,
    service: cloneJson(draft.service), quotas, limits: { ...limitValues, allowed_image_mimes: allowed_image_mimes_text.split(/[\n,]/).map(item => item.trim()).filter(Boolean) }, images: cloneJson(draft.images),
    models: { answer: draft.models.answer, vision: draft.models.vision, moderation: draft.models.moderation, title: draft.models.title, summary: draft.models.summary, allowlist },
    pricing: { version: integerField(String(draft.pricing.version), '价格版本'), effective_at: draft.pricing.effective_at, exchange_rate_micros: yuanToMicroCny(draft.pricing.exchange_rate_yuan), safety_margin_micros: yuanToMicroCny(draft.pricing.safety_margin_yuan), models: prices },
    moderation: cloneJson(draft.moderation), retention: cloneJson(draft.retention), starters: [...draft.starters] as AiSettings['starters']
  }
}

function submit(): void {
  try {
    localError.value = ''
    emit('save', buildSettings())
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '配置格式不正确'
  }
}

const activeTab = shallowRef('service')
const quotaNames = { global: '全站', account_default: '登录用户', anonymous_ip: '匿名 IP', anonymous_device: '匿名设备' }
const integerRules = [{ required: true, type: 'integer' as const, min: 0, message: '请输入非负整数' }]
const moneyRules = [{ required: true, validator: async (_rule: unknown, value: string) => { yuanToMicroCny(value) } }]
const limitFields = [
  { key: 'login_text_chars', label: '登录输入字符上限' }, { key: 'anonymous_text_chars', label: '匿名输入字符上限' },
  { key: 'context_target_tokens', label: '上下文目标 Token' }, { key: 'summary_trigger_tokens', label: '摘要触发 Token' },
  { key: 'recent_messages', label: '最近消息数' }, { key: 'max_output_tokens', label: '最大输出 Token' },
  { key: 'run_timeout_seconds', label: '生成超时（秒）' }, { key: 'image_concurrent', label: '图片并发' },
  { key: 'image_max_bytes', label: '图片最大字节' }, { key: 'image_max_pixels', label: '图片最大像素' }
] as const
const modelFields = [
  { key: 'answer', label: '回答模型' }, { key: 'vision', label: '视觉模型' }, { key: 'moderation', label: '审核模型' },
  { key: 'title', label: '标题模型' }, { key: 'summary', label: '摘要模型' }
] as const
const priceFields = [{ key: 'input_cache_hit', label: '缓存命中（元 / 百万 Token）' }, { key: 'input_cache_miss', label: '缓存未命中（元 / 百万 Token）' }, { key: 'output', label: '输出（元 / 百万 Token）' }] as const
watch(priceModels, models => { models.forEach(ensurePrice) }, { immediate: true })
function validationFailed({ errorFields }: { errorFields: Array<{ name: Array<string | number> }> }) {
  const field = errorFields[0]?.name[0]
  activeTab.value = field === 'quotas' || field === 'service' ? 'service' : field === 'limits' ? 'limits' : field === 'models' || field === 'images' ? 'models' : field === 'pricing' ? 'pricing' : 'other'
}

</script>

<template>
  <a-form class="settings-form" :model="draft" layout="vertical" :disabled="busy" @finish="submit" @finish-failed="validationFailed">
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="service" tab="服务与配额" force-render>
        <a-row :gutter="[24, 0]"><a-col :xs="24" :xl="12"><a-form-item label="关闭时维护文案" :name="['service', 'maintenance_message']"><a-textarea v-model:value="draft.service.maintenance_message" :rows="3" /></a-form-item></a-col></a-row>
        <a-divider orientation="left">日配额</a-divider>
        <a-alert type="info" show-icon message="各层配额同时生效，以最先耗尽的一层为准。预算按人民币元填写。" class="settings-hint" />
        <a-row :gutter="[16, 16]">
          <a-col v-for="(quota, name) in draft.quotas" :key="name" :xs="24" :md="12" :xxl="6">
            <a-card size="small" :title="quotaNames[name]">
              <a-form-item label="日预算（元）" :name="['quotas', name, 'daily_micro_cny_yuan']" :rules="moneyRules"><a-input v-model:value="quota.daily_micro_cny_yuan" inputmode="decimal" placeholder="例如 5" /></a-form-item>
              <a-form-item label="日轮数" :name="['quotas', name, 'daily_rounds']" :rules="integerRules"><a-input-number v-model:value="quota.daily_rounds" :min="0" :precision="0" class="full-width" /></a-form-item>
              <a-form-item :label="'最大生成并发（上限 ' + quotaConcurrentMax(name) + '）'" :name="['quotas', name, 'max_concurrent']" :rules="[{ required: true, type: 'integer', min: 0, max: quotaConcurrentMax(name), message: '请输入范围内的整数' }]"><a-input-number v-model:value="quota.max_concurrent" :min="0" :max="quotaConcurrentMax(name)" :precision="0" class="full-width" /></a-form-item>
              <a-form-item label="每分钟请求" :name="['quotas', name, 'requests_per_minute']" :rules="integerRules"><a-input-number v-model:value="quota.requests_per_minute" :min="0" :precision="0" class="full-width" /></a-form-item>
            </a-card>
          </a-col>
        </a-row>
      </a-tab-pane>
      <a-tab-pane key="limits" tab="输入与运行限制" force-render>
        <a-row :gutter="[24, 0]"><a-col v-for="field in limitFields" :key="field.key" :xs="24" :md="12" :xl="8"><a-form-item :label="field.label" :name="['limits', field.key]" :rules="integerRules"><a-input-number v-model:value="draft.limits[field.key]" :min="0" :precision="0" class="full-width" /></a-form-item></a-col></a-row>
        <a-form-item label="允许图片 MIME" :name="['limits', 'allowed_image_mimes_text']" extra="每行一个，或以逗号分隔"><a-textarea v-model:value="draft.limits.allowed_image_mimes_text" :rows="3" /></a-form-item>
      </a-tab-pane>
      <a-tab-pane key="models" tab="模型与图片" force-render>
        <a-row :gutter="[24, 0]"><a-col v-for="field in modelFields" :key="field.key" :xs="24" :md="12"><a-form-item :label="field.label" :name="['models', field.key]" :rules="[{ required: true, whitespace: true, message: '请输入模型名称' }]"><a-input v-model:value="draft.models[field.key]" /></a-form-item></a-col></a-row>
        <a-form-item label="模型白名单" :name="['models', 'allowlist_text']" extra="每行一个，或以逗号分隔"><a-textarea v-model:value="draft.models.allowlist_text" :rows="4" /></a-form-item>
        <a-form-item label="一次性图片"><a-switch v-model:checked="draft.images.enabled" checked-children="开启" un-checked-children="关闭" /></a-form-item>
      </a-tab-pane>
      <a-tab-pane key="pricing" tab="价格与汇率" force-render>
        <a-alert type="info" show-icon message="模型价格单位为人民币元 / 百万 Token，最多 6 位小数。保存时精确转换为微元整数。" class="settings-hint" />
        <a-row :gutter="[24, 0]">
          <a-col :xs="24" :md="8"><a-form-item label="价格版本" :name="['pricing', 'version']" :rules="integerRules"><a-input-number v-model:value="draft.pricing.version" :min="0" :precision="0" class="full-width" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="USD/CNY 汇率" :name="['pricing', 'exchange_rate_yuan']" :rules="moneyRules"><a-input v-model:value="draft.pricing.exchange_rate_yuan" inputmode="decimal" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="安全余量（元）" :name="['pricing', 'safety_margin_yuan']" :rules="moneyRules"><a-input v-model:value="draft.pricing.safety_margin_yuan" inputmode="decimal" /></a-form-item></a-col>
        </a-row>
        <a-card v-for="model in priceModels" :key="model" size="small" :title="model" class="price-card">
          <a-row :gutter="[24, 0]"><a-col v-for="field in priceFields" :key="field.key" :xs="24" :md="8"><a-form-item :label="field.label" :name="['pricing', 'models', model, field.key]" :rules="moneyRules"><a-input v-model:value="draft.pricing.models[model]![field.key]" inputmode="decimal" /></a-form-item></a-col></a-row>
        </a-card>
      </a-tab-pane>
      <a-tab-pane key="other" tab="审核与保留" force-render>
        <a-row :gutter="[24, 0]">
          <a-col :xs="24" :md="8"><a-form-item label="本地规则版本" :name="['moderation', 'rule_version']"><a-input v-model:value="draft.moderation.rule_version" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="失败日志保留天数" :name="['retention', 'failure_log_days']" :rules="integerRules"><a-input-number v-model:value="draft.retention.failure_log_days" :min="0" :precision="0" class="full-width" /></a-form-item></a-col>
          <a-col :xs="24" :md="8"><a-form-item label="审计日志保留天数" :name="['retention', 'audit_log_days']" :rules="integerRules"><a-input-number v-model:value="draft.retention.audit_log_days" :min="0" :precision="0" class="full-width" /></a-form-item></a-col>
        </a-row>
        <a-divider orientation="left">开场问题</a-divider>
        <a-row :gutter="[24, 0]"><a-col v-for="(_starter, index) in draft.starters" :key="index" :xs="24" :md="12"><a-form-item :label="'开场问题 ' + (index + 1)" :name="['starters', index]"><a-input v-model:value="draft.starters[index]" /></a-form-item></a-col></a-row>
      </a-tab-pane>
    </a-tabs>
    <a-alert v-if="localError" type="error" :message="localError" show-icon class="settings-hint" />
    <a-divider />
    <a-space wrap><a-button type="primary" html-type="submit" :loading="busy">保存全部设置</a-button><a-typography-text type="secondary">当前版本 {{ settings.revision }} · 所有分组一起保存</a-typography-text></a-space>
  </a-form>
</template>
<style scoped>
.full-width { width: 100%; }
.settings-hint { margin-bottom: 24px; }
.price-card { margin-bottom: 16px; }
</style>
