<script setup lang="ts">
import { shallowRef } from 'vue'
import type { AgentChat } from '@/features/agent/chat/model'

/** 侧栏管理重命名对话框；父组件负责服务端操作及选中会话。 */
defineProps<{ chats: AgentChat[]; selected: string; busy: boolean }>()
const emit = defineEmits<{ select: [id: string]; create: []; rename: [id: string, title: string]; remove: [id: string] }>()
const renaming = shallowRef('') // 对话框目标，与当前运行生命周期无关。
const title = shallowRef('') // 未保存标题在关闭对话框后仍暂存。
/** 初始化可编辑标题，不直接修改服务端快照。 */
function edit(chat: AgentChat): void { renaming.value = chat.chat_id; title.value = chat.title }
/** 发出明确的重命名意图；修订号校验由工作区和接口负责。 */
function save(): void { if (title.value.trim()) { emit('rename', renaming.value, title.value); renaming.value = '' } }
</script>

<template>
  <nav class="session-sidebar" aria-label="智能体临时会话">
    <a-button type="primary" block :loading="busy" @click="emit('create')">新建会话</a-button>
    <p class="session-hint">会话仅保留在当前服务进程，重启后清空。</p>
    <a-empty v-if="!chats.length" description="还没有临时会话" />
    <ul class="sessions">
      <li v-for="chat in chats" :key="chat.chat_id" class="session-row" :class="{ selected: selected === chat.chat_id }">
        <button class="session-select" :aria-current="selected === chat.chat_id ? 'page' : undefined" @click="emit('select', chat.chat_id)">
          <span class="session-title">{{ chat.title }}</span><small>{{ chat.current_run_id ? '运行中' : '临时会话' }}</small>
        </button>
        <div class="session-actions">
          <a-button type="text" size="small" :aria-label="`重命名 ${chat.title}`" @click="edit(chat)">改名</a-button>
          <a-popconfirm title="删除这个临时会话？" :disabled="!!chat.current_run_id" @confirm="emit('remove', chat.chat_id)"><a-button type="text" danger size="small" :disabled="!!chat.current_run_id" :aria-label="`删除 ${chat.title}`">删除</a-button></a-popconfirm>
        </div>
      </li>
    </ul>
    <RouterLink to="/">返回花园</RouterLink>
    <a-modal :open="!!renaming" title="重命名会话" @cancel="renaming = ''" @ok="save">
      <label for="agent-session-title">会话标题</label><a-input id="agent-session-title" v-model:value="title" :maxlength="80" @press-enter="save" />
    </a-modal>
  </nav>
</template>

<style scoped>
.session-sidebar { display: flex; flex-direction: column; gap: 16px; padding: 24px 16px; height: 100%; overflow: auto; }
.session-hint { color: var(--agent-muted, #595959); font-size: 13px; line-height: 1.7; margin: 0; }
.sessions { list-style: none; padding: 0; margin: 0; flex: 1; }
.session-row { border: 1px solid transparent; border-radius: 8px; margin-bottom: 8px; }
.session-row.selected { background: var(--agent-selected, #e6f4ff); border-color: var(--agent-border, #d9d9d9); }
.session-select { width: 100%; text-align: left; border: 0; padding: 12px; background: transparent; cursor: pointer; color: inherit; }
.session-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-select small { display: block; margin-top: 6px; color: var(--agent-muted, #595959); }
.session-actions { display: flex; justify-content: flex-end; padding: 0 4px 4px; }
.session-select:focus-visible { outline: 2px solid var(--agent-primary, #1677ff); outline-offset: -2px; border-radius: 6px; }
</style>
