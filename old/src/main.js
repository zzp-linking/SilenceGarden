// import 命令加载的 Vue 构建版本
// 已在 webpack.base.conf 中通过别名确定，可为仅运行时版或独立版。
import Vue from 'vue'
import App from './App'
import router from './router'
import store from './store'
import iView from 'iview';
import 'whatwg-fetch' //兼容IE fetch
import '@/config/base.less'
import '@/config/animate.css'

import 'mavon-editor/dist/css/index.css'
import 'muse-ui/lib/styles/base.less';
import 'muse-ui/lib/styles/theme.less';
import { TextField, Button } from 'muse-ui';
import theme from 'muse-ui/lib/theme';
import 'iview/dist/styles/iview.css'

theme.add('teal', {
  secondary: '#57a3f3'
}, 'light');
theme.use('teal');


Vue.use(TextField);
Vue.use(Button);
Vue.use(iView)
Vue.config.productionTip = false


/* eslint-disable no-new */
new Vue({
  el: '#app',
  store,
  router,
  components: { App },
  template: '<App/>'
})
