import router from '@/router'
import store from '@/store'
import {message} from '@/utils/talk'


export const json = (response) => response.json();
export const jsonay = (response) => response.json();


export const status = (response) => {
	if (response.status >= 200 && response.status < 300) {
	    	return response
	  }
	throw new Error(response.statusText)
} 
/*
 * 不需要登陆即可请求的接口
 */
export const analy = (response) => Promise.resolve(response).then(status).then(json).then(resultAny)


/*
 * 解析返回code,纯数组或对象
 */
export const resultAny = (datas) => {
	
	if (datas.code === 200) {
		if (Object.getOwnPropertyNames(datas.result).length === 1 && datas.result.list && Array.isArray(datas.result.list)) { 
			//返回数据里面仅有一个属性，属性名为list，且对应值类型为Array时返回该list
			return datas.result.list
		} else {
			return Object.assign({}, {msg: datas.message}, datas.result )
		}
		
	} else if (datas.code === 101) {
    message(datas.message, 4)
    router.push('/login');
  } else{
		if (datas.message) {
			message(datas.message, 4)
		}
		return undefined
	}
}

/*
 * 根据接口需要判断是否登陆状态
 */
export const onanaly = (response) => Promise.resolve(response).then(status).then(json).then(
	(dp) => {
		if (!dp.status) {
			router.push('/');
			return null;
		} else{
			return dp;
		}
	}
).then(resultAny);
/*
 * 解析JSON，判断是否登陆状态
 */
export const analyJson = (dp) => {
	if (!dp.status) {
		store.state.token = '',
		store.state.user = {},
		router.push('/login');
		return null;
	} else{
		return dp.result;
	}
}


/**
 * post method  带token
 * Requests  params, returning a common request config.
 *
 * @param  {object} params  the method wangt to post
 * 
 */
export const postModelOnline = ( params ) => {
	return {
		method: 'post',
		credentials: 'include',
		headers: {
		    'Accept': 'application/json',
		    'Content-Type': 'application/json'
		},
		body: JSON.stringify( 
			Object.assign( {}, { token: store.state.token }, {datas: params})
		)
	}
}

/**
 * post method  不带token
 * Requests  params, returning a common request config.
 *
 * @param  {object} params  the method wangt to post
 * 
 */
export const postModel = ( params ) => {
	return {
		method: 'post',
		credentials: 'include',
		headers: {
		    'Accept': 'application/json',
		    'Content-Type': 'application/json'
		},
		body: JSON.stringify( 
			Object.assign(params)
		)
	}
}

/*
 * get method 不带token
 */
export const getModel = () =>{
	return{
		method: 'get',
		credentials: 'include',
		headers: {
		    'Accept': 'application/json',
		    'Content-Type': 'application/json'
		}
	}
}


/*
 * restful url 拼接
 */
export const restful = (url, obj) => {
	Object.keys(obj).forEach(function (key) {
	    url = url.replace(new RegExp('{'+key+'}', 'g'), obj[key]);
	});
	return url;
}
