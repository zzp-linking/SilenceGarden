<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminAiStore } from '@/stores/ai/adminAi'

const store = useAdminAiStore()
const { audits, auditsPage, loading, error } = storeToRefs(store)
const limit = ref(50)

// 审计记录只在进入页面时加载，后续分页由用户显式触发。
onMounted(() => { void store.loadAudits({ limit: limit.value }) })
</script>

<template>
  <section class="admin-page">
    <header>
      <span class="eyebrow">只保留变更元数据</span>
      <h1>审计日志</h1>
    </header>
    <p class="privacy">不展示密码、API key、prompt、answer 或图片内容。</p>
    <p v-if="error" class="error">{{ error }}</p>
    <table>
      <thead><tr><th>时间</th><th>操作</th><th>目标</th><th>request ID</th><th>变更</th></tr></thead>
      <tbody>
        <tr v-for="item in audits" :key="`${item.request_id}-${item.created_at}`">
          <td>{{ item.created_at }}</td>
          <td>{{ item.action }}</td>
          <td>{{ item.target_type }}{{ item.target_id ? ` / ${item.target_id}` : '' }}</td>
          <td>{{ item.request_id }}</td>
          <td>{{ item.changes?.map(change => change.field).join('、') || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading">正在读取……</p>
    <button v-if="auditsPage?.next_cursor" type="button" @click="store.loadAudits({ cursor: auditsPage.next_cursor, limit: limit })">加载下一页</button>
  </section>
</template>

<style scoped>
.admin-page{max-width:1100px}.eyebrow{color:#8a9b8c;font-size:.7rem;letter-spacing:.15em}.admin-page h1{margin:.4rem 0 1.8rem;font:2.2rem 'STKaiti',serif;color:#31533e}.privacy{color:#8c998e;font-size:.75rem}.error{color:#966565}table{width:100%;margin-top:1.4rem;border-collapse:collapse;background:#fff}th,td{padding:.8rem;border-bottom:1px solid #edf1eb;text-align:left;font-size:.78rem;vertical-align:top}th{color:#8a998c;font-weight:500}button{margin-top:1rem;padding:.6rem .9rem;border:1px solid #9ebaa1;border-radius:8px;background:#477458;color:#fff}
</style>
