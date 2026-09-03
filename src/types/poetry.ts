export type PoemContent = string[] | string[][]

export interface PoetryCatalogItem {
  title: string
  poetry: string
  tag: string[]
}

export interface Poetry extends PoetryCatalogItem {
  _id?: string
  author?: string
  content: PoemContent
  section: boolean
  type?: 'poem' | 'essay' | string
}

export const emptyPoetry = (): Poetry => ({
  title: '',
  poetry: '',
  tag: [],
  content: [],
  section: false
})
