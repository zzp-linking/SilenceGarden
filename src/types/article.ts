/** 文章目录页使用的轻量条目。 */
export interface ArticleCatalogItem {
  /** MongoDB 文章记录 ID。 */
  _id: string
  /** 文章标题。 */
  title: string
  /** 用于分类和检索的标签列表。 */
  tags: string[]
}

/** 文章阅读页使用的详情。 */
export interface ArticleDetail {
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
  /** 编辑中的文章标题。 */
  title: string
  /** 编辑中的文章标签。 */
  tags: string[]
  /** 编辑器使用的 Markdown 源文。 */
  markdown: string
}

/** 编辑器提交保存前收集的文章内容。 */
export interface ArticleSaveInput {
  /** 要保存的文章标题。 */
  title: string
  /** 要保存的文章标签。 */
  tags: string[]
  /** Markdown 源文。 */
  markdown: string
  /** 与 Markdown 同步生成的 HTML 正文。 */
  html: string
}

/** 发往保存接口的完整请求。 */
export interface ArticleSaveRequest extends ArticleSaveInput {
  /** 被修改文章的 ID；新建文章时由 Store 使用空字符串。 */
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

/** 创建供编辑器初始化使用的空文章。 */
export const emptyArticleEditDetail = (): ArticleEditDetail => ({ title: '', tags: [], markdown: '' })
