import * as types from '../mutation-types'
import { GET_ARTICLE_DETAILS, GET_REVISE_ARTICLE_DETAILS, GET_ARTICLE_CATALOG,
         ARTICLE_SAVE, ARTICLE_IMAGE_UPLOAD } from '@/config/url'
import { postModel, getModel, restful, analy } from '@/utils/net'
import  { message } from  '@/utils/talk'
import  router from '@/router'

const state = {
  catalog: [],
  article: {},
  get_article_loading: true,
  upload_image: '',
  pos: 0,
  id: '', //需要修改的文章id
  revise_article: {}, //需要修改的文章内容
}

const actions = {
  async articleSave ({ commit }, obj) {
    const id = state.id
    const result = await fetch(ARTICLE_SAVE, postModel({ ...obj, id })).then(analy)
    result && message('保存文章成功！', 2, () => router.push('/article') )
  },
  async getArticleCatalog ({ commit }, obj) {
    const result = await fetch(GET_ARTICLE_CATALOG, getModel()).then(analy)
    console.log('result', result)
    result && commit(types.GET_ARTICLE_CATALOG, result)
  },
  async getArticleDetails ({ commit }, obj) {
    commit(types.GET_ARTICLE_DETAILS, {  article: {}, loading: true })
    try {
      const result = await fetch(restful(GET_ARTICLE_DETAILS, obj), getModel()).then(analy)
      result && commit(types.GET_ARTICLE_DETAILS, {  article: result, loading: false })
    } catch (e) {
      state.get_article_loading = false
      throw e
    }
  },
  async getReviseArticleDetails ({ commit }, obj) {
    const result = await fetch(restful(GET_REVISE_ARTICLE_DETAILS, obj), getModel()).then(analy)
    result && commit(types.GET_REVISE_ARTICLE_DETAILS, {  article: result, ...obj })
  },
  async articleImageUpload ({ commit }, { formdata, pos }) {
    const result = await fetch(ARTICLE_IMAGE_UPLOAD, {
      method: 'post',
      credentials: 'include',
      body: formdata
    }).then(analy)
    commit(types.ARTICLE_IMAGE_UPLOAD, { ...result, pos })
  }
}

const mutations = {
  [types.GET_ARTICLE_CATALOG] (state, obj) {
    state.catalog = obj
  },
  [types.GET_ARTICLE_DETAILS] (state, { article, loading }) {
    state.article = article
    state.id = undefined
    if (loading) {
      state.get_article_loading = loading
    } else  {
      setTimeout(() => state.get_article_loading = loading, 200)
    }
  },
  [types.ARTICLE_IMAGE_UPLOAD] (state, { image, pos }) {
    state.upload_image = image
    state.pos = pos
  },
  [types.GET_REVISE_ARTICLE_DETAILS] (state, { article, id }) {
    state.revise_article = article
    state.id = id
  }
}


export default{
  state,
  actions,
  mutations
}
