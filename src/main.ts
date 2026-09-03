import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'

import 'ant-design-vue/dist/reset.css'
import 'animate.css'
import '@/config/base.less'
import '@/config/garden.less'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(Antd)
  .mount('#app')
