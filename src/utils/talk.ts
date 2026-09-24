import { message as antMessage, notification as antNotification, Modal } from 'ant-design-vue'

export type NoticeType = 0 | 1 | 2 | 3 | 4
export type MessageType = 0 | 1 | 2 | 3 | 4

/** 展示带标题和描述的全局通知。 */
export function notice(
  title = '提示',
  desc = '将来送你上天堂',
  type: NoticeType = 0,
  duration = 3,
  onClose?: () => void
): void {
  const options = { message: title, description: desc, duration, onClose }
  switch (type) {
    case 2: antNotification.success(options); break
    case 3: antNotification.warning(options); break
    case 4: antNotification.error(options); break
    default: antNotification.info(options)
  }
}

/** 展示短时全局消息，并返回 Ant Design 的关闭句柄。 */
export function message(
  content = 'twinkle twinkle little star',
  type: MessageType = 0,
  onClose?: () => void,
  duration = 1.5
) {
  switch (type) {
    case 1: return antMessage.loading(content, duration, onClose)
    case 2: return antMessage.success(content, duration, onClose)
    case 3: return antMessage.warning(content, duration, onClose)
    case 4: return antMessage.error(content, duration, onClose)
    default: return antMessage.info(content, duration, onClose)
  }
}

/** 展示无需用户二次确认的信息模态框。 */
export function simpleModal(
  title = '信息',
  content = '确认继续操作',
  type: NoticeType = 0,
  onOk?: () => void | Promise<void>
): void {
  const options = { title, content, onOk }
  switch (type) {
    case 2: Modal.success(options); break
    case 3: Modal.warning(options); break
    case 4: Modal.error(options); break
    default: Modal.info(options)
  }
}

/** 展示带确认和取消回调的操作确认框。 */
export function confirmMoadl(
  title = '确认信息',
  content = '是否继续进行操作',
  onOk?: () => void | Promise<void>,
  onCancel?: () => void,
  okText = '确认',
  cancelText = '取消'
): void {
  Modal.confirm({ title, content, onOk, onCancel, okText, cancelText })
}

/** 开关跨页面共享的持续加载消息。 */
export function progressLoagding(status = false): void {
  // 固定 key 保证多次调用只更新同一个全局加载提示。
  if (status) {
    antMessage.loading({ content: '加载中...', key: 'global-loading', duration: 0 })
  } else {
    antMessage.destroy('global-loading')
  }
}
