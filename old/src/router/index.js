import Vue from 'vue'
import Router from 'vue-router'
import { CookieUtils } from '@/utils/cookie'
// import Home from '@/components/page/Home'
// import Poetry from '@/components/page/Poetry'
// import Poem from '@/components/page/Poem'
// import ViolinCatalog from '@/components/page/ViolinCatalog'
// import Violin from '@/components/page/Violin'
// import Article from '@/components/page/Article'
// import ArticleCatalog from '@/components/page/ArticleCatalog'
// import Editor from '@/components/page/Editor'

const Home = resolve => {
  // require.ensure 是 Webpack 的特殊语法，用来设置 code-split point
  // （代码分块）
  require.ensure(['@/components/page/Home.vue'], () => {
    resolve(require('@/components/page/Home.vue'))
  })
}
const Poetry = resolve => {
  require.ensure(['@/components/page/Poetry.vue'], () => {
    resolve(require('@/components/page/Poetry.vue'))
  })
}
const Poem = resolve => {
  require.ensure(['@/components/page/Poem.vue'], () => {
    resolve(require('@/components/page/Poem.vue'))
  })
}
const ViolinCatalog = resolve => {
  require.ensure(['@/components/page/ViolinCatalog.vue'], () => {
    resolve(require('@/components/page/ViolinCatalog.vue'))
  })
}
const Violin = resolve => {
  require.ensure(['@/components/page/Violin.vue'], () => {
    resolve(require('@/components/page/Violin.vue'))
  })
}
const Article = resolve => {
  require.ensure(['@/components/page/Article.vue'], () => {
    resolve(require('@/components/page/Article.vue'))
  })
}
const ArticleCatalog = resolve => {
  require.ensure(['@/components/page/ArticleCatalog.vue'], () => {
    resolve(require('@/components/page/ArticleCatalog.vue'))
  })
}
const Editor = resolve => {
  require.ensure(['@/components/page/Editor.vue'], () => {
    resolve(require('@/components/page/Editor.vue'))
  })
}
// 登录
const Login = resolve => {
  require.ensure(['@/components/page/Login.vue'], () => {
    resolve(require('@/components/page/Login.vue'))
  })
}


Vue.use(Router)

const router =  new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home
    },
    {
      path: '/poetry',
      name: 'Poetry',
      component: Poetry
    },
    {
      path: '/poem/:title',
      name: 'Poem',
      component: Poem
    },
    {
      path: '/violin',
      name: 'ViolinCatalog',
      component: ViolinCatalog
    },
    {
      path: '/violin/:id',
      name: 'Violin',
      component: Violin
    },
    {
      path: '/article',
      name: 'ArticleCatalog',
      component: ArticleCatalog
    },
    {
      path: '/article/:id',
      name: 'Article',
      component: Article
    },
		{
			path: '/write',
			name: 'Editor',
			component: Editor,
      meta: { auth: true }
		},
    {
      path: '/revise/:id',
      name: 'Editor-revise',
      component: Editor,
      meta: { auth: true }
    },
    {
      path: '/login',
      name: 'Login',
      component: Login
    },
  ]
})


router.beforeEach((to, from, next) => {
  if (to.meta.auth) {
    if (CookieUtils.get('uuid')) {
      next()
    } else{
      next('/login')
    }
  } else{
    next()
  }

})


export default router
