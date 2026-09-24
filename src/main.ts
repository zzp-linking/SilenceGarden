import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import { pinia } from '@/stores/pinia'
import { clientV2 } from '@/api/clientV2'
import { useUserStore } from '@/stores/user'

import 'ant-design-vue/dist/reset.css'
import 'animate.css'
import '@/config/base.less'
import '@/config/garden.less'
import '@/styles/whisper.css'

const app = createApp(App)
  .use(pinia)
  .use(router)
  .use(Antd)

clientV2.setUnauthorizedHandler(() => {
  // 刷新会话仍失败时统一清空用户，路由守卫会负责后续访问控制。
  useUserStore().setUser(null)
})

app.mount('#app')
