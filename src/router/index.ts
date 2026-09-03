import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { PUBLIC_PATH } from '@/config/url'
import { useUserStore } from '@/store/user'

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue') },
  { path: '/editor/:id?', name: 'Editor', component: () => import('@/views/Editor.vue'), meta: { auth: true } },
  { path: '/write', redirect: '/editor', meta: { auth: true } },
  { path: '/revise/:id', redirect: to => `/editor/${to.params.id}`, meta: { auth: true } },
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
  if (to.meta.auth && !useUserStore().token) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
