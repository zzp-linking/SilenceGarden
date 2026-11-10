<script setup lang="ts">
import { computed } from 'vue'
import { isAgentPlan, type AgentPlan } from '@/features/agent/chat/model'

const props = defineProps<{ plan?: AgentPlan }>() // 快照来自当前运行或已保存的助手消息。
const visible = computed(() => isAgentPlan(props.plan) ? props.plan : undefined) // 历史和快照也按公开契约校验。
const completed = computed(() => visible.value?.steps.filter(step => step.status === 'completed').length ?? 0) // 仅统计真实完成。
const actions: Record<AgentPlan['steps'][number]['kind'], string> = {
  knowledge: '查阅知识库', history: '回查会话', search: '搜索网页', read: '读取网页',
  download: '下载文件', export: '导出文件', answer: '整理回答'
}
const labels: Record<AgentPlan['steps'][number]['status'], string> = {
  pending: '待执行', running: '进行中', completed: '已完成', failed: '失败',
  skipped: '已跳过', interrupted: '已中断'
}
</script>

<template>
  <details v-if="visible" class="run-plan">
    <summary>执行步骤（{{ completed }}/{{ visible.steps.length }} 完成）</summary>
    <ol>
      <li v-for="step in visible.steps" :key="step.step_id" :aria-current="step.status === 'running' ? 'step' : undefined">
        <span>{{ actions[step.kind] }}</span>
        <span class="step-state" :data-status="step.status">{{ labels[step.status] }}</span>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.run-plan { margin: 8px 0; color: var(--agent-muted); font-size: 13px; }
.run-plan summary { cursor: pointer; width: fit-content; padding-block: 4px; }
.run-plan ol { margin: 4px 0 8px; padding-inline-start: 22px; }
.run-plan li { padding-block: 2px; }
.step-state { margin-inline-start: 10px; font-size: 12px; }
.step-state[data-status="running"] { color: #0958d9; }
.step-state[data-status="failed"], .step-state[data-status="interrupted"] { color: #a61d24; }
</style>
