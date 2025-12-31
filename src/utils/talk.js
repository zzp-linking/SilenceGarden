import { message as antMessage, notification as antNotification, Modal } from 'ant-design-vue'

/**
 * notice 方法 (对应 Antd 的 notification)
 * type:  0：默认，1：提示，2：成功，3：警告，4：错误
 */
export const notice = (title = '提示', desc = '将来送你上天堂', type = 0, duration = 3, onClose) => {
  const typeMap = {
    0: 'info',
    1: 'info',
    2: 'success',
    3: 'warning',
    4: 'error'
  }
  const method = typeMap[type] || 'info'
  antNotification[method]({
    message: title,
    description: desc,
    duration: duration,
    onClose: onClose
  })
}

/**
 * message 方法 (对应 Antd 的 message)
 * type:  0：默认，1：加载中，2：成功，3：警告，4：错误
 */
export const message = (content = 'twinkle twinkle little star', type = 0, onClose, duration = 1.5) => {
  const typeMap = {
    0: 'info',
    1: 'loading',
    2: 'success',
    3: 'warning',
    4: 'error'
  }
  const method = typeMap[type] || 'info'
  return antMessage[method](content, duration, onClose)
}

/**
 * simpleModal (对应 Antd 的 Modal.confirm)
 */
export const simpleModal = (title = '信息', content = '确认继续操作', type = 0, onOk) => {
  const typeMap = {
    0: 'info',
    1: 'info',
    2: 'success',
    3: 'warning',
    4: 'error'
  }
  const method = typeMap[type] || 'info'
  Modal[method]({
    title: title,
    content: content,
    onOk: onOk
  })
}

/**
 * confirmMoadl (对应 Antd 的 Modal.confirm)
 */
export const confirmMoadl = (title = '确认信息', content = '是否继续进行操作', onOk, onCancel, okText = '确认', cancelText = '取消') => {
  Modal.confirm({
    title: title,
    content: content,
    onOk: onOk,
    onCancel: onCancel,
    okText: okText,
    cancelText: cancelText
  })
}

/**
 * 页面加载状态 (Vite/Vue3 通常用 NProgress 或全局 Loading 组件)
 * 这里先做一个简单的占位
 */
export const progressLoagding = (status = false) => {
  if (status) {
    antMessage.loading({ content: '加载中...', key: 'global-loading', duration: 0 })
  } else {
    antMessage.destroy('global-loading')
  }
}

