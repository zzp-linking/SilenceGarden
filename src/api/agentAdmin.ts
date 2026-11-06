import { clientV2, type ClientV2 } from '@/api/clientV2'
import { isIndexSummary, type IndexSummary } from '@/api/agentIndexAdmin'

/** KnowledgeBase 是知识库与 Book 共用的元数据，Book 额外携带父知识库 ID 和可选忙碌状态。 */
export interface KnowledgeBase {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** knowledge_base_id：当前所属知识库的 UUIDv7；Book 与文档关联必须同库。 */
  knowledge_base_id?: string;
  /** name：供管理员展示和维护的名称。 */
  name: string;
  /** description：供管理员维护的说明文本。 */
  description: string;
  /** revision：元数据修订号，维护标题、标签、归属及删除时用于比较更新。 */
  revision: number;
  /** created_at：创建时间，供展示及稳定游标排序使用。 */
  created_at: string;
  /** updated_at：最近一次持久化变更时间。 */
  updated_at: string;
  /** index_busy：Book 是否含排队或执行中的文档；繁忙时禁止解散。 */
  index_busy?: boolean
}
/** SourceAsset 固定原文件的公开元数据，不包含服务器路径或可写入的来源替换字段。 */
export interface SourceAsset {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** original_name：仅供展示和下载的原始文件名，不用于拼接服务器路径。 */
  original_name: string;
  /** media_type：通过格式校验后的媒体类型。 */
  media_type: string;
  /** byte_size：实际原文件字节数，用于上传限制和读取完整性校验。 */
  byte_size: number;
  /** sha256：内容的 SHA-256 摘要，使用小写十六进制表示。 */
  sha256: string
}
/** KnowledgeDocument 文档当前元数据与不可变来源；元数据修订和索引修订分别维护。 */
export interface KnowledgeDocument {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** knowledge_base_id：当前所属知识库的 UUIDv7；Book 与文档关联必须同库。 */
  knowledge_base_id: string;
  /** book_id：所属 Book；null 表示独立文档，不表示删除文档。 */
  book_id: string | null;
  /** title：当前文档标题；修改标题不会替换固定原文件。 */
  title: string;
  /** tags：规范化标签集合；去空、转小写并去重后保存。 */
  tags: string[];
  /** source：不可变的原文件资产，供下载和后续索引校验使用。 */
  source: SourceAsset;
  /** revision：元数据修订号，维护标题、标签、归属及删除时用于比较更新。 */
  revision: number;
  /** created_at：创建时间，供展示及稳定游标排序使用。 */
  created_at: string;
  /** updated_at：最近一次持久化变更时间。 */
  updated_at: string;
  /** index：可选索引摘要；区分当前生效版本与正在执行的构建。 */
  index?: IndexSummary
}
/** KnowledgePage 稳定游标分页响应，不假设服务端提供总页数。 */
export interface KnowledgePage<T> {
  /** items：当前页条目；无数据时返回空集合。 */
  items: T[];
  /** next_cursor：下一页的不透明游标；为空表示没有下一页。 */
  next_cursor?: string
}
/** BaseMetadata 管理员编辑的完整知识库或 Book 元数据，不包含服务端修订字段。 */
export interface BaseMetadata {
  /** name：供管理员展示和维护的名称。 */
  name: string;
  /** description：供管理员维护的说明文本。 */
  description: string
}
/** DocumentMetadata 仅允许维护标题、标签与 Book 归属，原文件引用固定不变。 */
export interface DocumentMetadata {
  /** title：当前文档标题；修改标题不会替换固定原文件。 */
  title: string;
  /** tags：规范化标签集合；去空、转小写并去重后保存。 */
  tags: string[];
  /** book_id：所属 Book；null 表示独立文档，不表示删除文档。 */
  book_id: string | null
}
/** KnowledgeQuery 分页和当前元数据筛选参数，与后端列表过滤语义一致。 */
export interface KnowledgeQuery {
  /** cursor：上一页返回的不透明游标，不接受任意数据库偏移。 */
  cursor?: string;
  /** limit：单页条目上限；零值使用服务端默认值。 */
  limit?: number;
  /** book：Book 过滤：all 为全部，none 为独立文档，其他值为 Book ID。 */
  book?: string;
  /** title：按当前文档标题进行大小写不敏感的字面量子串过滤。 */
  title?: string;
  /** tag：规范化后精确匹配的单个标签。 */
  tag?: string
}

/** record：校验未知响应为非空、非数组的普通对象。 */
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
/** uuid：校验服务端资源 ID 为规范的小写 UUIDv7。 */
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
/** revision：校验元数据修订号为正的安全整数。 */
const revision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
/** timestamp：校验响应时间字段可被解析为有效时间。 */
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

/** 请求边界验证响应，避免缺失修订号或来源标识时继续写入。 */
/** @param v 请求边界收到的未知值，必须通过守卫后才能使用。 */
function isBase(v: unknown): v is KnowledgeBase { return record(v) && uuid(v.id) && typeof v.name === 'string' && typeof v.description === 'string' && revision(v.revision) && timestamp(v.created_at) && timestamp(v.updated_at) && (v.knowledge_base_id === undefined || uuid(v.knowledge_base_id)) && (v.index_busy === undefined || typeof v.index_busy === 'boolean') }
/**
 * isDocument 核对文档、固定来源和可选索引摘要，拒绝缺失修订的响应。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isDocument(v: unknown): v is KnowledgeDocument {
  if (!record(v) || !record(v.source)) return false
  return uuid(v.id) && uuid(v.knowledge_base_id) && (v.book_id === null || uuid(v.book_id)) && typeof v.title === 'string' && Array.isArray(v.tags) && v.tags.every(t => typeof t === 'string') && revision(v.revision) && timestamp(v.created_at) && timestamp(v.updated_at)
    && uuid(v.source.id) && typeof v.source.original_name === 'string' && typeof v.source.media_type === 'string' && typeof v.source.byte_size === 'number' && v.source.byte_size > 0 && typeof v.source.sha256 === 'string' && /^[0-9a-f]{64}$/.test(v.source.sha256)
    && (v.index === undefined || isIndexSummary(v.index))
}
/**
 * pageGuard 将单项类型守卫组合为游标分页响应守卫。
 * @param guard 将未知值收窄为目标类型的响应守卫。
 */
function pageGuard<T>(guard: (v: unknown) => v is T) { return (v: unknown): v is KnowledgePage<T> => record(v) && Array.isArray(v.items) && v.items.every(guard) && (v.next_cursor === undefined || typeof v.next_cursor === 'string') }
/**
 * queryString 编码有值的分页与过滤参数，省略 undefined 和空字符串。
 * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
 */
function queryString(query: KnowledgeQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value))
  return params.size ? `?${params}` : ''
}

/** 所有写操作禁用客户端 401 自动重放，网络失败后由管理员刷新核对结果。 */
export class AgentAdminApi {
  /**
   * constructor 注入 V2 客户端，默认复用应用请求实例，也便于测试替换。
   * @param client 供注入的 V2 请求客户端，默认复用应用实例。
   */
  constructor(private readonly client: ClientV2 = clientV2) {}
  /**
   * path 为资源相对路径添加知识管理的 V2 管理前缀。
   * @param resource 知识管理前缀下的相对资源路径。
   */
  private path(resource: string) { return `/admin/agent${resource}` }
  /**
   * checked 发送请求后验证未知响应；读取允许现有认证恢复，写入禁止自动重放。
   * @param resource 知识管理前缀下的相对资源路径。
   * @param guard 将未知值收窄为目标类型的响应守卫。
   * @param init 请求方法、请求体和取消信号等选项。
   */
  private async checked<T>(resource: string, guard: (v: unknown) => v is T, init?: RequestInit): Promise<T> {
    const value: unknown = await this.client.request(this.path(resource), init, !init?.method || init.method === 'GET')
    if (!guard(value)) throw new Error('知识管理响应无效，请刷新核对操作结果')
    return value
  }
  /**
   * bases 读取知识库的稳定游标分页。
   * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
   */
  bases(query?: KnowledgeQuery) { return this.checked(`/knowledge-bases${queryString(query)}`, pageGuard(isBase)) }
  /**
   * base 读取一个可用知识库的最新元数据。
   * @param id 知识库 UUIDv7。
   */
  base(id: string) { return this.checked(`/knowledge-bases/${encodeURIComponent(id)}`, isBase) }
  /**
   * books 读取指定知识库内的 Book 分页。
   * @param id 需要分页读取 Book 的父知识库 UUIDv7。
   * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
   */
  books(id: string, query?: KnowledgeQuery) { return this.checked(`/knowledge-bases/${encodeURIComponent(id)}/books${queryString(query)}`, pageGuard(isBase)) }
  /**
   * saveBase 根据 parent 和 existing 选择创建或更新入口；更新附带原元数据修订。
   * @param parent 父知识库 ID；null 表示操作知识库本身。
   * @param existing 更新所依据的旧元数据快照；null 表示新建。
   * @param input 待保存的完整名称和说明；修订从 existing 中读取。
   */
  saveBase(parent: string | null, existing: KnowledgeBase | null, input: BaseMetadata) {
    const path = existing ? (parent ? `/books/${existing.id}` : `/knowledge-bases/${existing.id}`) : (parent ? `/knowledge-bases/${parent}/books` : '/knowledge-bases')
    return this.checked(path, isBase, { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ ...input, ...(existing ? { revision: existing.revision } : {}) }) })
  }
  /**
   * removeBase 携带元数据修订删除空知识库或解散 Book，不自动重放。
   * @param value 需要校验、保存或操作的当前数据快照。
   * @param book 是否解散 Book；false 表示删除空知识库。
   */
  async removeBase(value: KnowledgeBase, book = false) { await this.client.request(this.path(`/${book ? 'books' : 'knowledge-bases'}/${value.id}`), { method: 'DELETE', body: JSON.stringify({ revision: value.revision }) }, false) }
  /**
   * documents 按当前元数据过滤读取文档分页，允许调用方取消过期读取。
   * @param id 需要读取文档列表的知识库 UUIDv7。
   * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  documents(id: string, query?: KnowledgeQuery, signal?: AbortSignal) { return this.checked(`/knowledge-bases/${encodeURIComponent(id)}/documents${queryString(query)}`, pageGuard(isDocument), { signal }) }
  /**
   * document 读取文档最新修订、固定来源及可选索引摘要。
   * @param id 需要读取最新修订与来源的文档 UUIDv7。
   */
  document(id: string) { return this.checked(`/documents/${encodeURIComponent(id)}`, isDocument) }
  /**
   * saveDocument 仅更新标题、标签和 Book，附带旧修订进行比较更新。
   * @param value 需要校验、保存或操作的当前数据快照。
   * @param input 完整标题、标签与 Book 归属，不包含可替换的原文件字段。
   */
  saveDocument(value: KnowledgeDocument, input: DocumentMetadata) { return this.checked(`/documents/${value.id}`, isDocument, { method: 'PATCH', body: JSON.stringify({ ...input, revision: value.revision }) }) }
  /**
   * upload 按 metadata 在前、唯一 file 在后的顺序上传，新建文档与固定资产。
   * @param id 接收新文档的知识库 UUIDv7。
   * @param input 新文档标题、标签与可空 Book 归属，不包含历史文档修订。
   * @param file 本次新上传的唯一原文件。
   */
  upload(id: string, input: DocumentMetadata, file: File) {
    const body = new FormData()
    // 后端严格流式处理：小型 metadata 在前，唯一 file 在后。
    body.append('metadata', JSON.stringify(input)); body.append('file', file)
    return this.checked(`/knowledge-bases/${encodeURIComponent(id)}/documents`, isDocument, { method: 'POST', body })
  }
  /**
   * removeDocument 携带元数据修订逻辑删除文档，原文件不立即物理回收。
   * @param value 需要校验、保存或操作的当前数据快照。
   */
  async removeDocument(value: KnowledgeDocument) { await this.client.request(this.path(`/documents/${value.id}`), { method: 'DELETE', body: JSON.stringify({ revision: value.revision }) }, false) }
  /**
   * source 读取固定原文件响应，保留附件下载所需的原始响应头。
   * @param id 需要下载固定原文件的文档 UUIDv7。
   */
  source(id: string) { return this.client.requestRaw(this.path(`/documents/${encodeURIComponent(id)}/source`)) }
}

/** agentAdminApi：应用共用的知识内容管理 API 实例。 */
export const agentAdminApi = new AgentAdminApi()
