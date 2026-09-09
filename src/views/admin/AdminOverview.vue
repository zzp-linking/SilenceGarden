<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminAiStore } from '@/stores/adminAi'
import { microCnyToYuan } from '@/utils/microCny'

const store = useAdminAiStore()
const { usage, loading, error } = storeToRefs(store)
let timer: ReturnType<typeof setInterval> | undefined
const actualYuan = computed(() => usage.value ? microCnyToYuan(usage.value.global.actual_micro_cny) : '0')

onMounted(() => { void store.loadUsage(); timer = setInterval(() => { void store.loadUsage() }, 10_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <section class="admin-page">
    <header class="page-head">
      <div><span class="eyebrow">静语 · 管理</span><h1>服务总览</h1></div>
      <span class="service-state" :class="{ off: !usage?.readiness.ready }">{{ usage?.readiness.ready ? '● 依赖就绪' : '○ 依赖未就绪' }}</span>
    </header>
    <p v-if="loading">正在读取聚合数据……</p>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="usage">
      <div class="metric-grid">
        <article><small>今日实际费用</small><strong>¥{{ actualYuan }}</strong><span>日期 {{ usage.date }}</span></article>
        <article><small>回答轮数</small><strong>{{ usage.global.answer_rounds }}</strong><span>活跃 run {{ usage.active_runs }}</span></article>
        <article><small>Tokens</small><strong>{{ usage.global.tokens.output + usage.global.tokens.input_cache_hit + usage.global.tokens.input_cache_miss }}</strong><span>思考 {{ usage.global.tokens.reasoning }}</span></article>
        <article><small>预占与失败</small><strong>{{ usage.active_reservations }}</strong><span>失败 {{ usage.global.failure_count }}</span></article>
      </div>
      <div class="readiness">
        <h2>依赖就绪</h2>
        <span :class="{ good: usage.readiness.ready }">{{ usage.readiness.ready ? 'Mongo / Redis / RunManager 正常' : `失败：${usage.readiness.failed?.join('、') || '未知'}` }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin-page { max-width: 1000px; }
.page-head { display: flex; justify-content: space-between; align-items: end; margin-bottom: 2rem; }
.eyebrow { color: #8a9b8c; font-size: .7rem; letter-spacing: .15em; }
.page-head h1 { margin: .4rem 0 0; font: 2.2rem 'STKaiti', serif; color: #31533e; }
.service-state { padding: .6rem .8rem; border: 1px solid #a7c0aa; border-radius: 20px; color: #477458; font-size: .78rem; }
.service-state.off { border-color: #d4b3b3; color: #936565; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.metric-grid article { display: grid; gap: .65rem; padding: 1.2rem; border: 1px solid #e0e8de; border-radius: 12px; background: #fff; }
.metric-grid small, .metric-grid span { color: #89978b; font-size: .72rem; }
.metric-grid strong { color: #31533e; font: 1.8rem ui-monospace, monospace; }
.readiness { display: flex; gap: 1rem; align-items: center; margin-top: 2rem; padding: 1rem; border-top: 1px solid #e0e8de; }
.readiness h2 { margin: 0; font: 1.2rem 'STKaiti', serif; }
.readiness span { color: #9a7777; font-size: .78rem; }
.readiness span.good { color: #477458; }
.error { color: #966565; }
@media (max-width: 780px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
