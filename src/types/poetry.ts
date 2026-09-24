/** 诗词正文：普通作品为行数组，分节作品为章节与行的二维数组。 */
export type PoemContent = string[] | string[][]

/** 诗词目录页使用的轻量条目。 */
export interface PoetryCatalogItem {
  /** 作品标题，也是详情查询参数。 */
  title: string
  /** 目录卡片展示的摘要或短文本。 */
  poetry: string
  /** 用于分类和搜索的标签。 */
  tag: string[]
}

/** 诗词或散文阅读页使用的完整内容。 */
export interface Poetry extends PoetryCatalogItem {
  /** MongoDB 内容记录 ID。 */
  _id?: string
  /** 作品作者。 */
  author?: string
  /** 按行或按章节组织的正文。 */
  content: PoemContent
  /** 正文是否采用分节的二维数组结构。 */
  section: boolean
  /** 内容类型；已知值为 poem 和 essay，并兼容服务端扩展值。 */
  type?: 'poem' | 'essay' | string
}

/** 创建阅读页初始化使用的空作品。 */
export const emptyPoetry = (): Poetry => ({ title: '', poetry: '', tag: [], content: [], section: false })
