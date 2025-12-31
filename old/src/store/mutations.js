import * as types from './mutation-types'
//import store from '@/store'
import router from '@/router'
import { CookieUtils } from '@/utils/cookie'

export const mutations = {
  [types.GLOBAL_LOADING] (state, { loading }) {
    //state.loading = loading
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
