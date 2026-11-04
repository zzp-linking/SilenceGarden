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
  // 刷新会话仍失败时统一完整退出；无登录身份时由页面自行处理 401。
  const userStore = useUserStore()
  if (userStore.isAuthenticated) userStore.expireSession()
})

app.mount('#app')
