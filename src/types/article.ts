/** 文章目录页使用的轻量条目。 */
export interface ArticleCatalogItem {
  type?: 'article' | 'collection'
  description?: string
  articleCount?: number
  time?: string
  collectionId?: string | null
  /** MongoDB 文章记录 ID。 */
  _id: string
  /** 文章标题。 */
  title: string
  /** 用于分类和检索的标签列表。 */
  tags: string[]
}

/** 文章阅读页使用的详情。 */
export interface ArticleDetail {
  collectionId?: string | null
  collectionSync?: 'complete' | 'pending'
  collection?: { _id: string; title: string; previous?: ArticleCatalogItem; next?: ArticleCatalogItem }
  /** MongoDB 文章记录 ID；空白初始对象中缺省。 */
  _id?: string
  /** 文章标题。 */
  title: string
  /** 文章标签列表。 */
  tags: string[]
  /** 已渲染并可供阅读页展示的 HTML 正文。 */
  html: string
  /** 文章发布时间或最后更新时间。 */
  time?: string
}

/** 编辑器加载已有文章时使用的可编辑内容。 */
export interface ArticleEditDetail {
  collectionId?: string | null
  /** 编辑中的文章标题。 */
  title: string
  /** 编辑中的文章标签。 */
  tags: string[]
  /** 编辑器使用的 Markdown 源文。 */
  markdown: string
}

/** 编辑器提交保存前收集的文章内容。 */
export interface ArticleSaveInput {
  requestId?: string
  collectionId?: string | null
  expectedCollectionId?: string | null
  /** 要保存的文章标题。 */
  title: string
  /** 要保存的文章标签。 */
  tags: string[]
  /** Markdown 源文。 */
  markdown: string
  /** 与 Markdown 同步生成的 HTML 正文。 */
  html: string
}

/** 保存目标由当前编辑动作决定，不从跨页面 Store 状态推断。 */
export type ArticleSaveTarget = { mode: 'create' } | { mode: 'edit'; id: string }

/** 发往保存接口的完整请求。 */
export interface ArticleSaveRequest extends ArticleSaveInput {
  /** 被修改文章的 ID；新建文章时明确传空字符串。 */
  id: string
}

/** 文章图片上传成功后的结果。 */
export interface ArticleImageUploadResult {
  /** 服务端保存后返回的图片访问地址。 */
  image: string
}

/** 编辑器上传图片时传入 Store 的参数。 */
export interface ArticleImageUploadInput {
  /** 包含图片二进制内容的表单数据。 */
  formdata: FormData
  /** 编辑器中待替换图片占位符的位置标识。 */
  pos: string | number
}

/** 创建供阅读页初始化使用的空文章。 */
export const emptyArticleDetail = (): ArticleDetail => ({ title: '', tags: [], html: '' })

/** 合集元数据及其权威阅读顺序快照。 */
export interface ArticleCollection {
  _id: string
  title: string
  description: string
  articleIds: string[]
  articleCount: number
  version: number
  time: string
  updateTime: string
  items: ArticleCatalogItem[]
}

/** 可恢复已有稳定回执，无需再次创建文章。 */
export interface ArticleWriteResult {
  operationId?: string
  state?: 'complete' | 'pending' | 'unknown' | 'failed'
  id?: string
  articleId?: string
  updated?: boolean
  matchedCount?: number
  collectionId?: string | null
  contentSaved?: boolean
  contentState?: 'saved' | 'not_saved' | 'not_applicable' | 'unknown'
  collectionSync?: 'complete' | 'pending' | 'unknown'
}
