<script setup lang="ts">
/**
 * 左侧历史：按今天 / 昨天 / 更早分组。
 * 桌面端 collapsed 折叠为窄条；窄屏 floating + open 作为抽屉。
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { Conversation, ConversationId } from '@/features/ai/model'
import AppIcon from './AppIcon.vue'
import WhisperRipple from './WhisperRipple.vue'

const props = defineProps<{
  items: Conversation[]
  currentId: ConversationId | null
  collapsed?: boolean
  loading?: boolean
  canSearch?: boolean
  showLogin?: boolean
  /** true 时作为覆盖在主栏上的抽屉，而不是文档流侧栏。 */
  floating?: boolean
  open?: boolean
}>()

const emit = defineEmits<{
  select: [id: ConversationId]
  create: []
  rename: [id: ConversationId, title: string]
  requestDelete: [id: ConversationId]
  search: [query: string]
  toggle: []
}>()

const query = ref('')
const menuFor = ref<ConversationId | null>(null)
const editing = ref<ConversationId | null>(null)
const editTitle = ref('')
const originalTitle = ref('')
const renameCancelled = ref(false)
/* 位于 v-for 内，模板 ref 收集为数组 */
const renameInput = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

interface ConversationGroup {
  label: string
  items: Conversation[]
}

/** 按「今天 / 昨天 / 更早」分组（产品设计文档 §8.2）。 */
const groups = computed<ConversationGroup[]>(() => {
  const today: Conversation[] = []
  const yesterday: Conversation[] = []
  const earlier: Conversation[] = []
  const startToday = new Date().setHours(0, 0, 0, 0)
  const startYesterday = startToday - 86_400_000
  for (const item of props.items) {
    const time = new Date(item.updated_at).getTime()
    if (Number.isNaN(time) || time >= startToday) today.push(item)
    else if (time >= startYesterday) yesterday.push(item)
    else earlier.push(item)
  }
  const result: ConversationGroup[] = []
  if (today.length) result.push({ label: '今天', items: today })
  if (yesterday.length) result.push({ label: '昨天', items: yesterday })
  if (earlier.length) result.push({ label: '更早', items: earlier })
  return result
})

function toggleMenu(id: ConversationId): void {
  menuFor.value = menuFor.value === id ? null : id
}
function closeMenu(): void {
  menuFor.value = null
}

/** 进入行内重命名：先记下原标题，取消时靠 renameCancelled 避免 blur 误提交。 */
function beginRename(item: Conversation): void {
  closeMenu()
  editing.value = item.id
  editTitle.value = item.title
  originalTitle.value = item.title
  renameCancelled.value = false
}
watch(editing, async value => {
  if (!value) return
  await nextTick()
  const input = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
  input?.focus()
  input?.select()
})
function saveRename(): void {
  const id = editing.value
  if (!id) return
  editing.value = null
  const title = editTitle.value.trim()
  if (!renameCancelled.value && title && title !== originalTitle.value) emit('rename', id, title)
}
function cancelRename(): void {
  renameCancelled.value = true
  editing.value = null
}

function requestDelete(id: ConversationId): void {
  closeMenu()
  emit('requestDelete', id)
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{ collapsed: collapsed && !floating, floating, open }"
    aria-label="对话历史"
    @keydown.esc="closeMenu"
  >
    <div class="sidebar-head">
      <template v-if="!collapsed || floating">
        <div class="sidebar-brand"><span class="seal">语</span><span class="brand-name">静语</span></div>
        <button v-if="floating" class="icon-button" type="button" aria-label="关闭历史" @click="emit('toggle')">
          <AppIcon name="x" :size="18" />
        </button>
        <button v-else class="icon-button" type="button" aria-label="收起历史" title="收起历史" @click="emit('toggle')">
          <AppIcon name="panel-left-close" :size="17" />
        </button>
      </template>
      <button v-else class="icon-button" type="button" aria-label="展开历史" title="展开历史" @click="emit('toggle')">
        <AppIcon name="panel-left-open" :size="17" />
      </button>
    </div>

    <!-- 桌面端折叠轨道 -->
    <div v-if="collapsed && !floating" class="rail">
      <button class="icon-button" type="button" aria-label="新对话" title="新对话" @click="emit('create')">
        <AppIcon name="square-pen" :size="17" />
      </button>
    </div>

    <template v-if="!collapsed || floating">
      <button class="new-chat" type="button" @click="emit('create')">
        <AppIcon name="square-pen" :size="16" /><span>新对话</span>
      </button>

      <label v-if="canSearch" class="search">
        <AppIcon name="search" :size="15" />
        <input v-model="query" name="conversation-search" type="search" placeholder="搜索历史" aria-label="搜索历史" @input="emit('search', query)" />
      </label>

      <div class="history whisper-scroll" :aria-busy="loading">
        <p v-if="!items.length" class="history-empty">还没有留下对话</p>
        <div v-for="group in groups" :key="group.label" class="history-group">
          <p class="group-label">{{ group.label }}</p>
          <ul class="group-list">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="history-row"
              :class="{ selected: currentId === item.id, 'menu-open': menuFor === item.id }"
            >
              <div v-if="editing === item.id" class="rename-row">
                <input
                  ref="renameInput"
                  v-model="editTitle"
                  class="rename-input"
                  name="conversation-title"
                  aria-label="对话名称"
                  maxlength="60"
                  @keydown.enter.prevent="saveRename"
                  @keydown.esc.prevent="cancelRename"
                  @blur="saveRename"
                />
              </div>
              <template v-else>
                <button class="history-select" type="button" :title="item.title" @click="emit('select', item.id)">
                  <span class="history-title">{{ item.title }}</span>
                  <small v-if="item.source === 'ephemeral'" class="history-badge">本次访问</small>
                </button>
                <span class="row-trailing">
                  <WhisperRipple v-if="item.active_run_id" :size="14" class="row-ripple" />
                  <button
                    class="row-menu-button"
                    type="button"
                    :aria-label="`管理对话：${item.title}`"
                    :aria-expanded="menuFor === item.id"
                    aria-haspopup="menu"
                    @click.stop="toggleMenu(item.id)"
                  >
                    <AppIcon name="ellipsis" :size="16" />
                  </button>
                </span>
                <div v-if="menuFor === item.id" class="row-menu" role="menu" aria-label="对话操作">
                  <button type="button" role="menuitem" @click="beginRename(item)">
                    <AppIcon name="pencil" :size="14" /><span>重命名</span>
                  </button>
                  <button type="button" role="menuitem" class="danger" @click="requestDelete(item.id)">
                    <AppIcon name="trash-2" :size="14" /><span>删除</span>
                  </button>
                </div>
              </template>
            </li>
          </ul>
        </div>
      </div>

      <router-link v-if="showLogin" to="/login" class="sidebar-login">
        <AppIcon name="log-in" :size="15" /><span>登录保存历史</span>
      </router-link>
    </template>

    <!-- 菜单外点击关闭层（与菜单同处一个层叠上下文） -->
    <div v-if="menuFor" class="menu-scrim" aria-hidden="true" @click="closeMenu" @contextmenu.prevent="closeMenu"></div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  display: flex;
  width: 280px;
  flex: 0 0 280px;
  flex-direction: column;
  padding: 12px;
  border-right: 1px solid var(--whisper-line);
  background: var(--whisper-sidebar);
  transition: width 200ms var(--whisper-ease), flex-basis 200ms var(--whisper-ease), transform 240ms var(--whisper-ease);
}
.sidebar.collapsed {
  width: 68px;
  flex-basis: 68px;
  align-items: center;
  padding: 12px 0;
}
.sidebar.floating {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  width: min(300px, 84vw);
  flex-basis: auto;
  visibility: hidden;
  border-right: 0;
  box-shadow: var(--whisper-shadow-dialog);
  transform: translateX(-105%);
  transition: transform 240ms var(--whisper-ease), visibility 0s 240ms;
}
.sidebar.floating.open {
  visibility: visible;
  transform: translateX(0);
  transition: transform 240ms var(--whisper-ease);
}

.sidebar-head {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
}
.collapsed .sidebar-head {
  justify-content: center;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-left: 4px;
}
.seal {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--whisper-seal);
  border-radius: 6px;
  color: var(--whisper-seal);
  font-family: 'STKaiti', serif;
  font-size: 16px;
  transform: rotate(-5deg);
}
.brand-name {
  color: var(--whisper-ink);
  font-family: 'STKaiti', serif;
  font-size: 19px;
  letter-spacing: 0.06em;
}

.icon-button {
  display: grid;
  min-width: 40px;
  min-height: 40px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-soft);
  cursor: pointer;
  transition: background var(--whisper-duration) var(--whisper-ease), color var(--whisper-duration) var(--whisper-ease);
}
.icon-button:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}

.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.new-chat {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 14px 2px 10px;
  border: 1px solid var(--whisper-line-strong);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-blue-deep);
  font-size: 14px;
  cursor: pointer;
  transition: border-color var(--whisper-duration) var(--whisper-ease), box-shadow var(--whisper-duration) var(--whisper-ease), transform var(--whisper-duration) var(--whisper-ease);
}
.new-chat:hover {
  border-color: var(--whisper-violet);
  box-shadow: 0 4px 14px rgba(128, 104, 216, 0.16);
  transform: translateY(-1px);
}

.search {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 2px;
  padding: 0 12px;
  min-height: 38px;
  border: 1px solid var(--whisper-line);
  border-radius: 999px;
  background: var(--whisper-surface);
  color: var(--whisper-ink-faint);
  transition: border-color var(--whisper-duration) var(--whisper-ease);
}
.search:focus-within {
  border-color: var(--whisper-violet);
}
.search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--whisper-ink);
  font-size: 13px;
}
.search input::placeholder {
  color: var(--whisper-ink-faint);
}

.history {
  flex: 1;
  margin-top: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.history-empty {
  padding: 40px 8px;
  color: var(--whisper-ink-faint);
  font-size: 12.5px;
  text-align: center;
}
.history-group + .history-group {
  margin-top: 12px;
}
.group-label {
  margin: 0 0 2px;
  padding: 0 12px;
  color: var(--whisper-ink-faint);
  font-size: 11px;
  letter-spacing: 0.06em;
}
.group-list {
  margin: 0;
  padding: 0;
}

.history-row {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: var(--whisper-radius-md);
}
.history-row:hover,
.history-row:focus-within,
.history-row.menu-open {
  background: var(--whisper-hover);
}
.history-row.selected {
  background: var(--whisper-active);
}
.history-select {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 10px 4px 10px 12px;
  border: 0;
  background: transparent;
  color: var(--whisper-ink-soft);
  text-align: left;
  cursor: pointer;
}
.selected .history-select {
  color: var(--whisper-ink);
}
.history-title {
  overflow: hidden;
  flex: 1;
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-badge {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--whisper-mist);
  color: var(--whisper-blue-deep);
  font-size: 10.5px;
}

.row-trailing {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding-right: 6px;
}
.row-ripple {
  margin-right: 2px;
}
.row-menu-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--whisper-ink-faint);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--whisper-duration) var(--whisper-ease), background var(--whisper-duration) var(--whisper-ease);
}
.history-row:hover .row-menu-button,
.history-row:focus-within .row-menu-button,
.history-row.menu-open .row-menu-button {
  opacity: 1;
}
@media (hover: none) {
  .row-menu-button {
    opacity: 1;
  }
}
.row-menu-button:hover {
  background: var(--whisper-mist-deep);
  color: var(--whisper-ink);
}

.row-menu {
  position: absolute;
  top: calc(100% - 4px);
  right: 8px;
  z-index: 10;
  display: grid;
  min-width: 132px;
  padding: 5px;
  border: 1px solid var(--whisper-line);
  border-radius: var(--whisper-radius-md);
  background: var(--whisper-surface);
  box-shadow: var(--whisper-shadow-menu);
}
.row-menu button {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--whisper-radius-sm);
  background: transparent;
  color: var(--whisper-ink-soft);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.row-menu button:hover {
  background: var(--whisper-hover);
  color: var(--whisper-ink);
}
.row-menu button.danger {
  color: var(--whisper-danger);
}
.row-menu button.danger:hover {
  background: rgba(180, 35, 24, 0.08);
}
.menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 5;
}

.rename-row {
  display: flex;
  flex: 1;
  padding: 4px 6px 4px 10px;
}
.rename-input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid var(--whisper-violet);
  border-radius: var(--whisper-radius-sm);
  outline: none;
  background: var(--whisper-surface);
  color: var(--whisper-ink);
  font-size: 13.5px;
}

.sidebar-login {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  margin: 10px 2px 2px;
  border: 1px dashed var(--whisper-line-strong);
  border-radius: 999px;
  color: var(--whisper-blue-deep);
  font-size: 13px;
  text-decoration: none;
  transition: background var(--whisper-duration) var(--whisper-ease), border-color var(--whisper-duration) var(--whisper-ease);
}
.sidebar-login:hover {
  border-color: var(--whisper-blue);
  background: var(--whisper-hover);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .new-chat,
  .icon-button,
  .row-menu-button {
    transition: none;
  }
}
</style>
