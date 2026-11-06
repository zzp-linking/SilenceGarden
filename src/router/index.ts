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
  { path: '/article/collection/:id', name: 'ArticleCollection', component: () => import('@/views/ArticleCollection.vue') },
  { path: '/article/:id', name: 'Article', component: () => import('@/views/Article.vue') },
  { path: '/poetry', name: 'Poetry', component: () => import('@/views/Poetry.vue') },
  { path: '/poem/:title', name: 'Poem', component: () => import('@/views/Poem.vue') },
  { path: '/violin', name: 'ViolinCatalog', component: () => import('@/views/ViolinCatalog.vue') },
  { path: '/violin/:id', name: 'Violin', component: () => import('@/views/Violin.vue') },
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
  { path: '/ai', name: 'AiChat', component: () => import('@/views/AiChat.vue'), meta: { layout: 'fullscreen' } },
  // 任务 1 工作区独立于既有普通聊天路由和 store。
  { path: '/agent/chat', name: 'AgentChat', component: () => import('@/views/agent/Chat.vue'), meta: { auth: true, layout: 'fullscreen' } },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { auth: true, roles: ['admin'], layout: 'fullscreen' },
    children: [
      { path: 'agent/model-configs', name: 'AdminAgentModels', component: () => import('@/views/admin/agent/ModelConfigs.vue') },
      // 知识管理复用父级管理员权限；详情页采用独立懒加载组件。
      { path: 'agent/knowledge-bases', name: 'AdminKnowledgeBases', component: () => import('@/views/admin/agent/KnowledgeBases.vue') },
      { path: 'agent/knowledge-bases/:id', name: 'AdminKnowledgeBaseDetail', component: () => import('@/views/admin/agent/KnowledgeBaseDetail.vue') },
      // 任务详情共用管理员权限门禁，并支持按标识刷新恢复。
      { path: 'agent/index-jobs/:jobId?', name: 'AdminIndexJobs', component: () => import('@/views/admin/agent/IndexJobs.vue') },
      { path: '', name: 'AdminOverview', component: () => import('@/views/admin/AdminOverview.vue') },
      { path: 'article-collections', name: 'AdminArticleCollections', component: () => import('@/views/admin/AdminArticleCollections.vue') },
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
