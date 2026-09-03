import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { PUBLIC_PATH } from '@/config/url'
import { useUserStore } from '@/store/user'
import type { UserRole } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean
    roles?: UserRole[]
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
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') }
]

const router = createRouter({
  history: createWebHistory(`${PUBLIC_PATH}/`),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (to.name === 'Poetry') return false
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  }
})

router.beforeEach(to => {
  const userStore = useUserStore()
  if (to.meta.auth && !userStore.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.roles && (!userStore.user || !to.meta.roles.includes(userStore.user.role))) {
    return { name: 'Home' }
  }
  return true
})

export default router
