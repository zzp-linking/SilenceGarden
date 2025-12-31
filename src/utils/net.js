import axios from 'axios'
import router from '@/router'
import { useUserStore } from '@/store/user'
import { message } from '@/utils/talk'

const service = axios.create({
  timeout: 10000,
  withCredentials: true
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    const userStore = useUserStore()
    if (userStore.token) {
      // 兼容旧项目的逻辑：将 token 放在 body 的 datas 中，或者 header
      // 这里根据旧项目的 net.js 逻辑，它是放在 body 里的
      if (config.method === 'post' && config.data) {
        config.data = {
          token: userStore.token,
          datas: config.data
        }
      }
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data
    // 兼容旧项目的 resultAny 逻辑
    if (res.code === 200) {
      if (res.result && Object.getOwnPropertyNames(res.result).length === 1 && res.result.list && Array.isArray(res.result.list)) {
        return res.result.list
      }
      return { msg: res.message, ...res.result }
    } else if (res.code === 101) {
      message(res.message, 4)
      const userStore = useUserStore()
      userStore.logout()
      router.push('/login')
      return Promise.reject(new Error(res.message || 'Error'))
    } else {
      if (res.message) {
        message(res.message, 4)
      }
      return Promise.reject(new Error(res.message || 'Error'))
    }
  },
  error => {
    message(error.message, 4)
    return Promise.reject(error)
  }
)

export default service

/**
 * 兼容旧项目的 restful 拼接
 */
export const restful = (url, obj) => {
  Object.keys(obj).forEach(function (key) {
    url = url.replace(new RegExp('{' + key + '}', 'g'), obj[key])
  })
  return url
}

