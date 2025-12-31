/*
 * 用于触发全局提示，通知提醒，对话框，全局加载中等
 */
import store from '@/store'
const top = 500 //notice 提示框距离顶部距离，单位像素

/*
 * notice 方法
 * type:  0：默认，1：提示，2：成功，3：警告，4：错误，其他：默认
 */
export const notice = (title = '提示', desc = '将来送你上天堂', type = 0, duration =  3, onClose, key) => {
	let config = null;
	
	if (key) {
		config = {
			title: title,
			desc: desc,
			duration: duration,
			key: key,
			top: top,
			onClose: onClose
		}
	} else {
		config = {
			title : title,
			desc: desc,
			top: top,
			duration: duration,
			onClose: onClose
		}
	}
	store.state.notice.type = type;
	store.state.notice.config = config;
	store.state.notice.state++;
}
/*
 * 关闭 notice 方法
 */
export const noticeClose = (key) => {
	store.state.noticeClose.key = key;
	store.state.noticeClose.state++;
}

/*
 * message 方法
 * type:  0：默认，1：加载中，2：成功，3：警告，4：错误，其他：默认
 */
export const message = (content = 'twinkle twinkle little star', type = 0, onClose, duration = 1.5 ) => {
	if (type === 1) {
		duration = 0;
	}
	let config = {
		content: content,
		duration: duration,
		onClose: onClose
	}
	store.state.message.type = type;
	store.state.message.config = config;
	store.state.message.state++;
}


/*
 * modal 一次性轻量级对话框
 */
/*
 * 基本，只含有一个确定按钮，可用有点击确认的回掉
 * type: 0：默认，1：默认，2：成功，3：警告，4：错误，其他：默认
 */
export const simpleModal = (title = '信息', content = '确认继续操作', type = 0, onOk) => {
	let config = {
		title: title,
		content: content,
		onOk: onOk
	}
	store.state.simpleModal.type = type;
	store.state.simpleModal.config = config;
	store.state.simpleModal.state++;
}
/*
 * 确认型对话框 有两个回调
 * 确认回调可设置loading状态
 */
export const confirmMoadl = (title = '确认信息', content = '是否继续进行操作', onOk, onCancel, okText = '确认', cancelText = '取消', loading = false) => {
	let config = {
		title: title,
		content: content,
		onOk: onOk,
		onCancel: onCancel,
		okText: okText,
		cancelText: cancelText,
		loading: loading
	}
	store.state.confirmMoadl.config = config;
	store.state.confirmMoadl.state++;
}

/**
 * 页面加载状态
 */
 export const progressLoagding = (status = false) => {
	store.state.progress = status;
 }
