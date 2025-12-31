import * as types from '../mutation-types'
import {LOGIN} from '@/config/url'
import {postModelTwo,analy} from '@/utils/net'
import {message} from '@/utils/talk'
import store from '@/store'
import router from '@/router'

const state = {
	poem: {
		title: '采薇'
	}
}

const getters = {
	filterCheck: state =>state.filterCheck
}

const actions = {
	login ({commit},obj){
		fetch(LOGIN, postModelTwo(obj)).then(analy)
				.then((datas)=>{
				commit(types.LOGIN, datas);
				console.log(datas)
			}).catch(function(error) {
			  });
  	}
}

const mutations = {
	[types.LOGIN] (state,obj) {
		store.state.token = obj.token;
		store.state.user = obj.user;
		message(obj.msg, 2, () => 
			{
				router.push('/')
			}
		);
    }
}


export default{
	state,
	getters,
	actions,
	mutations
}
