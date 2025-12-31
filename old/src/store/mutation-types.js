import {BASEURL} from "../config/url";

export const LOGIN = 'LOGIN' //登录

export const GLOBAL_LOADING = 'GLOBAL_LOADING' //全局loading

export const GET_ARTICLE_DETAILS = 'GET_ARTICLE_DETAILS' //获取文章详情
export const GET_REVISE_ARTICLE_DETAILS = 'GET_REVISE_ARTICLE_DETAILS' //获取需要修订的文章详情
export const GET_ARTICLE_CATALOG = 'GET_ARTICLE_CATALOG' //获取文章目录
export const ARTICLE_SAVE = 'ARTICLE_SAVE' //文章保存
export const ARTICLE_IMAGE_UPLOAD = BASEURL + '/article/image/upload' //写文章图片上传

export const GET_POETRY_CATALOG = 'GET_POETRY_CATALOG' //获取诗词目录
export const GET_POEM = 'GET_POEM' //获取诗词
export const POETRY_SEARCH_KEYWORD_UPDATE = 'POETRY_SEARCH_KEYWORD_UPDATE' // 诗词搜索关键字更新


export const GET_MELODY_CATALOG = 'GET_MELODY_CATALOG' //获取音频目录
export const GET_MELODY = 'GET_MELODY'  	//	获取音频信息
export const GET_MELODY_RANDOM = 'GET_MELODY_RANDOM'    //随机播放
