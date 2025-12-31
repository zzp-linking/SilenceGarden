export const BASEURL = '/api'  //服务器地址
export const AUTH = '/auth'     //需要登录验证的接口

export const IMG = '/assets/image' //图片地址

export const LOGIN = BASEURL + '/login' //登录

export const GET_ARTICLE_DETAILS = BASEURL + '/article/details/{id}' //获取文章详情
export const GET_REVISE_ARTICLE_DETAILS = BASEURL + AUTH + '/revise/article/details/{id}' // 修改文章页面获取文章详情
export const GET_ARTICLE_CATALOG = BASEURL + '/article/catalog' //获取文章目录
export const ARTICLE_SAVE = BASEURL +AUTH + '/article/save' //文章保存
export const ARTICLE_IMAGE_UPLOAD = BASEURL + AUTH + '/article/image/upload' //写文章图片上传

export const GET_POETRY_CATALOG = BASEURL + '/poetry_catalog' //诗词目录
export const GET_POEM = BASEURL + '/poem/{title}' //获取诗词
export const GET_POETRY_CATALOG_VAGUE = BASEURL + '/poetry_catalog/vague/{keyword}' //模糊查询筛选诗词


export const GET_MELODY_CATALOG = BASEURL + '/violin_catalog' //获取音频目录
export const GET_MELODY = BASEURL + '/melody/{id}'  	//	获取音频信息
export const GET_MELODY_RANDOM = BASEURL + '/melody/ramdom/{id}'    //随机播放
