<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
const localError = ref('')

const quotaConcurrentMaximum: Record<keyof AiSettings['quotas'], number> = {
  global: 8,
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
watch(() => props.settings, value => Object.assign(draft, toDraft(value)), { deep: true })

const priceModels = computed(() => Array.from(new Set([...draft.models.allowlist, ...Object.keys(draft.pricing.models)])))

function ensurePrice(model: string): PriceDraft {
  // allowlist 新增模型时先创建空价格行，避免模板访问 undefined。
  if (!draft.pricing.models[model]) draft.pricing.models[model] = { input_cache_hit: '0', input_cache_miss: '0', output: '0' }
  return draft.pricing.models[model]
}

function setPrice(model: string, key: keyof PriceDraft, event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) ensurePrice(model)[key] = target.value
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
</script>

<template>
  <form class="settings-form" @submit.prevent="submit">
    <fieldset>
      <legend>服务文案</legend>
      <label>关闭时维护文案<textarea v-model="draft.service.maintenance_message" rows="2" /></label>
    </fieldset>

    <fieldset>
      <legend>四类日配额</legend>
      <div class="quota-grid">
        <section v-for="(quota, name) in draft.quotas" :key="name" class="sub-card">
          <h3>{{ name === 'global' ? '全站' : name === 'account_default' ? '登录用户' : name === 'anonymous_ip' ? '匿名 IP' : '匿名设备' }}</h3>
          <label>日预算（元）<input v-model="quota.daily_micro_cny_yuan" inputmode="decimal" min="0" placeholder="例如 5" /></label>
          <label>日轮数<input v-model.number="quota.daily_rounds" type="number" min="0" step="1" /></label>
          <label>最大并发（上限 {{ quotaConcurrentMax(name) }}）<input v-model.number="quota.max_concurrent" type="number" min="0" :max="quotaConcurrentMax(name)" step="1" /></label>
          <label>每分钟请求<input v-model.number="quota.requests_per_minute" type="number" min="0" step="1" /></label>
        </section>
      </div>
      <p class="hint">全站额度是所有身份共享的总上限；登录用户、匿名 IP 和匿名设备额度还会分别限制各自范围，实际以最先耗尽的一层为准。预算输入按人民币元展示，保存时使用整数 micro_cny。</p>
    </fieldset>

    <fieldset>
      <legend>输入、上下文与运行限制</legend>
      <div class="field-grid">
        <label>登录输入字符<input v-model.number="draft.limits.login_text_chars" type="number" min="0" /></label>
        <label>匿名输入字符<input v-model.number="draft.limits.anonymous_text_chars" type="number" min="0" /></label>
        <label>上下文目标 tokens<input v-model.number="draft.limits.context_target_tokens" type="number" min="0" /></label>
        <label>摘要触发 tokens<input v-model.number="draft.limits.summary_trigger_tokens" type="number" min="0" /></label>
        <label>最近消息数<input v-model.number="draft.limits.recent_messages" type="number" min="0" /></label>
        <label>最大输出 tokens<input v-model.number="draft.limits.max_output_tokens" type="number" min="0" /></label>
        <label>Run 超时（秒）<input v-model.number="draft.limits.run_timeout_seconds" type="number" min="0" /></label>
        <label>图片并发<input v-model.number="draft.limits.image_concurrent" type="number" min="0" /></label>
        <label>图片最大字节<input v-model.number="draft.limits.image_max_bytes" type="number" min="0" /></label>
        <label>图片最大像素<input v-model.number="draft.limits.image_max_pixels" type="number" min="0" /></label>
      </div>
      <label>允许图片 MIME（逗号或换行分隔）<textarea v-model="draft.limits.allowed_image_mimes_text" rows="2" /></label>
    </fieldset>

    <fieldset>
      <legend>模型与图片</legend>
      <div class="field-grid">
        <label>Answer 模型<input v-model="draft.models.answer" /></label>
        <label>Vision 模型<input v-model="draft.models.vision" /></label>
        <label>Moderation 模型<input v-model="draft.models.moderation" /></label>
        <label>Title 模型<input v-model="draft.models.title" /></label>
        <label>Summary 模型<input v-model="draft.models.summary" /></label>
      </div>
      <label>Model allowlist（每行一个）<textarea v-model="draft.models.allowlist_text" rows="3" /></label>
      <label class="checkbox"><input v-model="draft.images.enabled" type="checkbox" />启用一次性图片</label>
    </fieldset>

    <fieldset>
      <legend>价格与汇率</legend>
      <div class="field-grid">
        <label>价格版本<input v-model.number="draft.pricing.version" type="number" min="0" step="1" /></label>
        <label>USD/CNY 汇率（元）<input v-model="draft.pricing.exchange_rate_yuan" inputmode="decimal" placeholder="例如 7.14" /></label>
        <label>安全余量（元）<input v-model="draft.pricing.safety_margin_yuan" inputmode="decimal" placeholder="例如 0.01" /></label>
      </div>
      <p class="hint">模型价格单位为“人民币元 / 百万 tokens”，最多 6 位小数；保存时精确转换为 micro_cny 整数。</p>
      <div v-for="model in priceModels" :key="model" class="price-card">
        <h3>{{ model }}</h3>
        <div class="field-grid">
          <label>缓存命中 元/百万<input :value="ensurePrice(model).input_cache_hit" inputmode="decimal" @input="setPrice(model, 'input_cache_hit', $event)" /></label>
          <label>缓存未命中 元/百万<input :value="ensurePrice(model).input_cache_miss" inputmode="decimal" @input="setPrice(model, 'input_cache_miss', $event)" /></label>
          <label>输出 元/百万<input :value="ensurePrice(model).output" inputmode="decimal" @input="setPrice(model, 'output', $event)" /></label>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>审核、保留和开场问题</legend>
      <div class="field-grid">
        <label>本地规则版本<input v-model="draft.moderation.rule_version" /></label>
        <label>失败日志保留天数<input v-model.number="draft.retention.failure_log_days" type="number" min="0" /></label>
        <label>审计日志保留天数<input v-model.number="draft.retention.audit_log_days" type="number" min="0" /></label>
      </div>
      <div class="starters">
        <label v-for="(_starter, index) in draft.starters" :key="index">开场问题 {{ index + 1 }}<input v-model="draft.starters[index]" /></label>
      </div>
    </fieldset>

    <p v-if="localError" class="error">{{ localError }}</p>
    <button class="save" type="submit" :disabled="busy">保存完整 settings（revision {{ settings.revision }}）</button>
  </form>
</template>

<style scoped>
.settings-form { display: grid; gap: 1.2rem; margin-top: 1.5rem; }
fieldset { display: grid; gap: 1rem; min-width: 0; padding: 1.2rem; border: 1px solid #e0e8de; border-radius: 12px; background: #fff; }
legend { padding: 0 .4rem; color: #31533e; font-weight: 700; }
label { display: grid; gap: .35rem; color: #718173; font-size: .78rem; }
input, textarea { width: 100%; box-sizing: border-box; padding: .62rem; border: 1px solid #dce5da; border-radius: 7px; background: #fff; color: #303b33; font: inherit; }
textarea { resize: vertical; }
.field-grid, .quota-grid, .starters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
.quota-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sub-card, .price-card { display: grid; gap: .7rem; padding: .8rem; border: 1px solid #edf1eb; border-radius: 9px; }
h3 { margin: 0; color: #477458; font-size: .85rem; }
.price-card { margin-top: .8rem; }
.hint { margin: 0; color: #8a998c; font-size: .75rem; line-height: 1.5; }
.checkbox { display: flex; grid-template-columns: auto 1fr; align-items: center; gap: .5rem; }
.checkbox input { width: auto; }
.save { justify-self: start; padding: .7rem 1rem; border: 1px solid #9ebaa1; border-radius: 8px; background: #477458; color: #fff; cursor: pointer; }
.save:disabled { cursor: wait; opacity: .6; }
.error { margin: 0; color: #966565; }
@media (max-width: 900px) { .quota-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .field-grid, .quota-grid, .starters { grid-template-columns: 1fr; } }
</style>
