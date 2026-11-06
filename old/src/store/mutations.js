import * as types from './mutation-types'
// 历史代码参考：import store from '@/store'
import router from '@/router'
import { CookieUtils } from '@/utils/cookie'

export const mutations = {
  [types.GLOBAL_LOADING] (state, { loading }) {
    // 历史代码参考：state.loading = loading
    if (loading) {
      state.loading = loading
    } else {
      setTimeout(() => state.loading = loading, 200)
    }
  },
  [types.LOGIN] (state, { uuid }) {
    CookieUtils.del('uuid')
    CookieUtils.set('uuid', uuid)
    router.push('/')
  }
}
