<script setup lang="ts">
import { computed, h, shallowRef, watch } from 'vue'
import { Grid, theme } from 'ant-design-vue'
import { RouterLink, useRoute } from 'vue-router'
import { AppstoreOutlined, BookOutlined, TeamOutlined, SettingOutlined, WarningOutlined, AuditOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const route = useRoute()
const screens = Grid.useBreakpoint()
const mobile = computed(() => screens.value.lg === false)
const collapsed = shallowRef(false)
const drawerOpen = shallowRef(false)
const navigation = [
  { key: '/admin', label: '服务总览', icon: AppstoreOutlined },
  { key: '/admin/article-collections', label: '文章合集', icon: BookOutlined },
  { key: '/admin/users', label: '用户管理', icon: TeamOutlined },
  { key: '/admin/ai-settings', label: 'AI 设置', icon: SettingOutlined },
  { key: '/admin/ai-runs', label: '失败日志', icon: WarningOutlined },
  { key: '/admin/audit-logs', label: '审计日志', icon: AuditOutlined }
]
const items = navigation.map(item => ({ key: item.key, icon: () => h(item.icon), label: h(RouterLink, { to: item.key }, () => item.label) }))
const selectedKeys = computed(() => [route.path.replace(/\/$/, '') || '/admin'])
const currentTitle = computed(() => navigation.find(item => item.key === selectedKeys.value[0])?.label || '管理后台')
const adminTheme = { algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1677ff', colorBgLayout: '#f5f5f5', borderRadius: 6, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif' } }
watch(() => route.path, () => { drawerOpen.value = false })
watch(mobile, () => { drawerOpen.value = false })
function toggleNavigation() { if (mobile.value) drawerOpen.value = true; else collapsed.value = !collapsed.value }
</script>

<template>
  <a-config-provider :theme="adminTheme">
    <a-app class="admin-app">
      <a-layout class="admin-shell">
        <a-layout-sider v-if="!mobile" v-model:collapsed="collapsed" :width="224" theme="light" class="admin-sider">
          <RouterLink to="/admin" class="admin-brand" aria-label="静语管理首页"><a-avatar shape="square" :size="32" class="admin-logo"><AppstoreOutlined /></a-avatar><strong v-if="!collapsed">静语管理</strong></RouterLink>
          <a-menu aria-label="管理导航" mode="inline" :selected-keys="selectedKeys" :items="items" />
        </a-layout-sider>
        <a-drawer v-if="mobile" v-model:open="drawerOpen" title="静语管理" placement="left" :width="264" :body-style="{ padding: '12px 0' }">
          <a-menu aria-label="管理导航" mode="inline" :selected-keys="selectedKeys" :items="items" />
        </a-drawer>
        <a-layout class="admin-workspace">
          <a-layout-header class="admin-header">
            <a-space :size="16">
              <a-button type="text" :aria-label="mobile ? '打开菜单' : collapsed ? '展开菜单' : '收起菜单'" @click="toggleNavigation"><MenuUnfoldOutlined v-if="collapsed || mobile" /><MenuFoldOutlined v-else /></a-button>
              <a-breadcrumb><a-breadcrumb-item>管理后台</a-breadcrumb-item><a-breadcrumb-item>{{ currentTitle }}</a-breadcrumb-item></a-breadcrumb>
            </a-space>
            <a-space :size="16">
              <RouterLink to="/ai" class="admin-return" aria-label="返回静语"><ArrowLeftOutlined /><span class="admin-return-label">返回静语</span></RouterLink>
              <a-space :size="8"><a-avatar :size="28"><UserOutlined /></a-avatar><span class="admin-account">{{ userStore.user?.account }}</span></a-space>
            </a-space>
          </a-layout-header>
          <a-layout-content class="admin-content"><RouterView /></a-layout-content>
        </a-layout>
      </a-layout>
    </a-app>
  </a-config-provider>
</template>

<style>
.admin-app { height: 100%; }
.admin-shell { height: 100vh; height: 100dvh; min-width: 0; color: #262626; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; }
.admin-shell .admin-sider { border-right: 1px solid #f0f0f0; overflow: auto; }
.admin-brand { display: flex; align-items: center; justify-content: center; gap: 12px; height: 64px; color: #141414; font-size: 18px; white-space: nowrap; }
.admin-brand .admin-logo { background: #1677ff; }
.admin-workspace { min-width: 0; }
.admin-shell .admin-header { height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; line-height: normal; background: #fff; border-bottom: 1px solid #f0f0f0; }
.admin-return { display: inline-flex; align-items: center; gap: 8px; color: #595959; }
.admin-content { overflow: auto; min-height: 0; padding: 24px; }
.admin-page { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; min-width: 0; }
.admin-page-head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.admin-page-title { margin: 0 0 8px; font-size: 24px; line-height: 1.35; font-weight: 600; color: #141414; }
.admin-page-description { margin: 0; color: #8c8c8c; font-size: 14px; line-height: 1.6; }
.admin-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.admin-pagination { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.admin-muted { color: #8c8c8c; }
.admin-mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
@media (max-width: 767px) { .admin-shell .admin-header { padding: 0 12px; } .admin-content { padding: 16px; } .admin-page { gap: 16px; } .admin-account, .admin-return-label { display: none; } .admin-page-title { font-size: 22px; } }
</style>
