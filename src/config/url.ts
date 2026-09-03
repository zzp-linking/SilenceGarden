export const PUBLIC_PATH = '/home'
export const BASEURL = `${PUBLIC_PATH}/api`
export const AUTH = '/auth'

export const IMG = `${PUBLIC_PATH}/assets/image`
export const AUDIO = `${PUBLIC_PATH}/assets/audio`

export const LOGIN = `${BASEURL}/login`

export const GET_ARTICLE_DETAILS = `${BASEURL}/article/details/{id}`
export const GET_REVISE_ARTICLE_DETAILS = `${BASEURL}${AUTH}/revise/article/details/{id}`
export const GET_ARTICLE_CATALOG = `${BASEURL}/article/catalog`
export const ARTICLE_SAVE = `${BASEURL}${AUTH}/article/save`
export const ARTICLE_IMAGE_UPLOAD = `${BASEURL}${AUTH}/article/image/upload`

export const GET_POETRY_CATALOG = `${BASEURL}/poetry_catalog`
export const GET_POEM = `${BASEURL}/poem/{title}`
export const GET_POETRY_CATALOG_VAGUE = `${BASEURL}/poetry_catalog/vague/{keyword}`

export const GET_MELODY_CATALOG = `${BASEURL}/violin_catalog`
export const GET_MELODY = `${BASEURL}/melody/{id}`
export const GET_MELODY_RANDOM = `${BASEURL}/melody/random/{id}`
