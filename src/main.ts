import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import { pinia } from '@/store/pinia'

import 'ant-design-vue/dist/reset.css'
import 'animate.css'
import '@/config/base.less'
import '@/config/garden.less'
import '@/styles/whisper.css'

createApp(App)
  .use(pinia)
  .use(router)
  .use(Antd)
  .mount('#app')
