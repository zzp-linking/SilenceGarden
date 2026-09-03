export interface ArticleCatalogItem {
  _id: string
  title: string
  tags: string[]
}

export interface ArticleDetail {
  _id?: string
  title: string
  tags: string[]
  html: string
  time?: string
}

export interface ArticleEditDetail {
  title: string
  tags: string[]
  markdown: string
}

export interface ArticleSaveInput {
  title: string
  tags: string[]
  markdown: string
  html: string
}

export interface ArticleSaveRequest extends ArticleSaveInput {
  id: string
}

export interface ArticleImageUploadResult {
  image: string
}

export interface ArticleImageUploadInput {
  formdata: FormData
  pos: string | number
}

export const emptyArticleDetail = (): ArticleDetail => ({
  title: '',
  tags: [],
  html: ''
})

export const emptyArticleEditDetail = (): ArticleEditDetail => ({
  title: '',
  tags: [],
  markdown: ''
})
