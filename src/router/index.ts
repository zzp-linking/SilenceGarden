import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { PUBLIC_PATH } from '@/config/url'
import { useUserStore } from '@/stores/user'
import type { UserRole } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean
    roles?: UserRole[]
    layout?: 'default' | 'fullscreen'
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue') },
  { path: '/editor/:id?', name: 'Editor', component: () => import('@/views/Editor.vue'), meta: { auth: true, roles: ['admin'] } },
  { path: '/write', redirect: '/editor', meta: { auth: true, roles: ['admin'] } },
  { path: '/revise/:id', redirect: to => `/editor/${to.params.id}`, meta: { auth: true, roles: ['admin'] } },
  { path: '/article', name: 'ArticleCatalog', component: () => import('@/views/ArticleCatalog.vue') },
  { path: '/article/:id', name: 'Article', component: () => import('@/views/Article.vue') },
  { path: '/poetry', name: 'Poetry', component: () => import('@/views/Poetry.vue') },
  { path: '/poem/:title', name: 'Poem', component: () => import('@/views/Poem.vue') },
  { path: '/violin', name: 'ViolinCatalog', component: () => import('@/views/ViolinCatalog.vue') },
  { path: '/violin/:id', name: 'Violin', component: () => import('@/views/Violin.vue') },
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
  { path: '/ai', name: 'AiChat', component: () => import('@/views/AiChat.vue'), meta: { layout: 'fullscreen' } },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { auth: true, roles: ['admin'], layout: 'fullscreen' },
    children: [
      { path: '', name: 'AdminOverview', component: () => import('@/views/admin/AdminOverview.vue') },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/AdminUsers.vue') },
      { path: 'ai-settings', name: 'AdminAiSettings', component: () => import('@/views/admin/AdminAiSettings.vue') },
      { path: 'ai-runs', name: 'AdminAiFailures', component: () => import('@/views/admin/AdminAiFailures.vue') },
      { path: 'audit-logs', name: 'AdminAuditLogs', component: () => import('@/views/admin/AdminAuditLogs.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(`${PUBLIC_PATH}/`),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    // 诗词页自行维护阅读位置；浏览器后退则优先恢复历史滚动坐标。
    if (to.name === 'Poetry') return false
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  }
})

router.beforeEach(async to => {
  const userStore = useUserStore()
  // 首次导航先恢复 Cookie 会话，避免刷新受保护路由时被误判为未登录。
  if (!userStore.hydrated) await userStore.hydrate()
  if (to.meta.auth && !userStore.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.roles && (!userStore.user || !to.meta.roles.includes(userStore.user.role))) {
    return { name: 'Home' }
  }
  return true
})

export default router
