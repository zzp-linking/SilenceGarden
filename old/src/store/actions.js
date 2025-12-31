import * as types from './mutation-types'
import  { LOGIN } from '@/config/url'
import { postModel, analy } from '@/utils/net'
//import { confirmMoadl } from '@/tool/talk'

export const actions = {
  login ({commit}, obj){
    fetch(LOGIN, postModel(obj)).then(analy).then(
      datas => datas && commit(types.LOGIN, datas)
    )
  },
}
