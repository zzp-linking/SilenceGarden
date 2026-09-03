import { createRouter, createWebHistory } from 'vue-router'
import { CookieUtils } from '@/utils/cookie'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/editor/:id?',
    name: 'Editor',
    component: () => import('@/views/Editor.vue'),
    meta: { auth: true }
  },
  {
    path: '/write',
    redirect: '/editor',
    meta: { auth: true }
  },
  {
    path: '/revise/:id',
    redirect: to => `/editor/${to.params.id}`,
    meta: { auth: true }
  },
  {
    path: '/article',
    name: 'ArticleCatalog',
    component: () => import('@/views/ArticleCatalog.vue')
  },
  {
    path: '/article/:id',
    name: 'Article',
    component: () => import('@/views/Article.vue')
  },
  {
    path: '/poetry',
    name: 'Poetry',
    component: () => import('@/views/Poetry.vue')
  },
  {
    path: '/poem/:title',
    name: 'Poem',
    component: () => import('@/views/Poem.vue')
  },
  {
    path: '/violin',
    name: 'ViolinCatalog',
    component: () => import('@/views/ViolinCatalog.vue')
  },
  {
    path: '/violin/:id',
    name: 'Violin',
    component: () => import('@/views/Violin.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  }
]

const router = createRouter({
  history: createWebHistory('/home/'),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // 诗词目录由页面自身在数据渲染完成后恢复滚动位置。
    if (to.name === 'Poetry') {
      return false
    }
    // 页面跳转时回到顶部；浏览器后退时恢复用户离开前的位置。
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0, left: 0 }
  }
})

router.beforeEach((to, from, next) => {
  if (to.meta.auth) {
    if (CookieUtils.get('uuid')) {
      next()
    } else {
      next('/login')
    }
  } else {
    next()
  }
})

export default router

