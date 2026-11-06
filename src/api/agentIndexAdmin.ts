import { clientV2, type ClientV2 } from '@/api/clientV2'
import type { KnowledgePage, KnowledgeQuery } from '@/api/agentAdmin'

/** 路径和配置由服务端管理；以下类型只表达可公开的业务事实。 */
export type IndexMode = 'build' | 'force'
/** IndexState 实际执行条目的持久化状态；任务整体状态由成员聚合。 */
export type IndexState = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted' | 'skipped'
/** IndexCounts 任务固定成员的逐状态统计，共享 item 按每个 job 的成员关系计入。 */
export interface IndexCounts {
  /** total：该任务固定成员的总数，包含引用共享条目的成员。 */
  total: number;
  /** queued：尚待 worker 认领的成员数。 */
  queued: number;
  /** running：已被 worker 认领且尚未终态化的成员数。 */
  running: number;
  /** succeeded：完整构建并成功激活的成员数。 */
  succeeded: number;
  /** failed：构建失败的成员数，不包括中断和跳过。 */
  failed: number;
  /** interrupted：因服务停止或所有权更替而中断的成员数。 */
  interrupted: number;
  /** skipped：已存在相同有效索引而无需重建的成员数。 */
  skipped: number
}
/** IndexJob 不可变管理命令的聚合头部，mode 保留原始构建意图。 */
export interface IndexJob {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** mode：该管理命令的 build/force 意图，重试时从来源任务继承。 */
  mode: IndexMode;
  /** state：根据该任务固定成员计数派生的聚合状态，混合失败不能显示为全部成功。 */
  state: 'queued' | 'running' | 'succeeded' | 'completed_with_errors' | 'interrupted';
  /** counts：由固定成员实际状态聚合的任务计数。 */
  counts: IndexCounts;
  /** created_at：创建时间，供展示及稳定游标排序使用。 */
  created_at: string;
  /** origin_job_id：重试来源任务 ID，用于验证成员关系并继承原命令模式。 */
  origin_job_id?: string
}
/** IndexJobDetail 任务头部以及提交时的命令和目标快照，供刷新恢复与历史追溯。 */
export interface IndexJobDetail extends IndexJob {
  /** command：提交时规范化的不可变命令快照。 */
  command: Record<string, unknown>;
  /** target_snapshot：提交时展开的 Book 和文档快照，后续改名不改写历史。 */
  target_snapshot: Record<string, unknown>
}
/** IndexItem 一篇文档的一次真实执行事实，可被多个等价命令共享。 */
export interface IndexItem {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** document_id：实际执行或命中的文档 ID。 */
  document_id: string;
  /** state：该执行条目的真实持久化状态，不受后续重试结果覆盖。 */
  state: IndexState;
  /** phase：当前执行阶段，仅用于进度展示，不作为成功依据。 */
  phase: string;
  /** index_version_id：执行条目或片段对应的索引版本；未分配时可为空。 */
  index_version_id: string | null;
  /** completed_chunks：已完整保存的片段数，不代表版本已经激活。 */
  completed_chunks: number;
  /** total_chunks：本次解析切分后预期保存的片段总数。 */
  total_chunks: number;
  /** error_code：可对外展示的稳定业务错误码。 */
  error_code?: string;
  /** error_message：经过安全映射的失败原因，不含路径或原生堆栈。 */
  error_message?: string;
  /** created_at：创建时间，供展示及稳定游标排序使用。 */
  created_at: string;
  /** updated_at：最近一次持久化变更时间。 */
  updated_at: string
}
/** IndexJobItem 任务成员的执行事实，额外提供当前来源与共享次数。 */
export interface IndexJobItem extends IndexItem {
  /** title：当前文档标题；修改标题不会替换固定原文件。 */
  title: string;
  /** knowledge_base_id：当前所属知识库的 UUIDv7；Book 与文档关联必须同库。 */
  knowledge_base_id: string;
  /** document_deleted：文档或其知识库是否已逻辑删除，删除后仍显示历史但不能重试。 */
  document_deleted: boolean;
  /** shared_job_count：引用同一执行条目的管理任务数。 */
  shared_job_count: number
}
/** IndexSummary 分开描述当前 active 与在途工作；重建期间旧 active 可以继续检索。 */
export interface IndexSummary {
  /** index_revision：独立索引修订号，清除和单篇构建使用此值进行比较更新。 */
  index_revision: number;
  /** active_version_id：唯一生效版本；为空表示文档当前没有可检索索引。 */
  active_version_id: string | null;
  /** profile_id：不可变 Embedding 档案 ID，不仅用于区分向量维度。 */
  profile_id: string | null;
  /** chunk_count：生效索引中的有效片段数量。 */
  chunk_count: number;
  /** busy：是否存在 queued/running 执行条目，与旧 active 是否仍可检索相互独立。 */
  busy: boolean;
  /** item：当前执行条目的事实快照。 */
  item?: IndexItem;
  /** recent_job_id：最近终态条目所属的来源任务，用于保留重试意图。 */
  recent_job_id?: string;
  /** recent_mode：最近来源任务的 build/force 模式。 */
  recent_mode?: IndexMode;
  /** recent_terminal：最近一次完成、失败或中断的执行事实。 */
  recent_terminal?: IndexItem
}
/** IndexRuntimeState 服务端运行状态快照，仅含安全原因及档案标识，不含部署路径。 */
export interface IndexRuntimeState {
  /** ready：本地模型、数据库所有权及依赖是否实际就绪。 */
  ready: boolean;
  /** worker_enabled：部署是否启用索引 worker。 */
  worker_enabled: boolean;
  /** accepting：服务端与本地状态共同确认是否允许接纳新的索引命令。 */
  accepting: boolean;
  /** retrieval_enabled：部署是否启用检索能力。 */
  retrieval_enabled: boolean;
  /** retrieval_ready：当前是否具备实际执行检索的模型和所有权。 */
  retrieval_ready: boolean;
  /** reason：可向管理员展示的安全不可用原因，不含部署路径。 */
  reason: string;
  /** profile_id：不可变 Embedding 档案 ID，不仅用于区分向量维度。 */
  profile_id: string | null;
  /** space_id：向量坐标空间 ID；相同维度不代表相同空间。 */
  space_id: string | null;
  /** dimension：模型输出的固定向量维度。 */
  dimension: number;
  /** config_id：不可变解析切分配置 ID。 */
  config_id: string | null;
  /** serving_revision：检索服务配置修订，向量化前后须保持一致。 */
  serving_revision: number;
  /** queued：当前数据库中的全局排队条目数。 */
  queued: number;
  /** running：当前数据库中的全局执行中条目数。 */
  running: number;
  /** observed_at：运行快照的读取时间，用于判断展示信息的新鲜度。 */
  observed_at: string
}
/** SourceSpan 规范文本内的 UTF-8 字节范围及格式实际提供的位置，不能作为原文件二进制偏移。 */
export interface SourceSpan {
  /** start：规范文本中的 UTF-8 起始字节偏移，包含此位置。 */
  start: number;
  /** end：规范文本中的 UTF-8 结束字节偏移，不包含此位置。 */
  end: number;
  /** line_start：真实起始行号，从一开始；零表示格式未提供行定位。 */
  line_start?: number;
  /** line_end：真实结束行号，从一开始；零表示格式未提供行定位。 */
  line_end?: number;
  /** page：真实 PDF 页码，从一开始；不为 DOCX 虚构页码。 */
  page?: number;
  /** paragraph：原文段落序号，从一开始；无此定位时为零。 */
  paragraph?: number;
  /** table：原表格序号，从一开始；无此定位时为零。 */
  table?: number;
  /** row：原表格行号，从一开始；无此定位时为零。 */
  row?: number
}
/** ChunkPreview 当前生效索引的只读原文片段，不包含向量或合成模型上下文。 */
export interface ChunkPreview {
  /** id：资源的稳定 UUIDv7 标识。 */
  id: string;
  /** ordinal：从零开始的片段顺序号，用于稳定排序和连续性校验。 */
  ordinal: number;
  /** text：规范化原文或片段正文，供来源定位和引用展示。 */
  text: string;
  /** tokens：包含前缀、上下文及特殊 token 的完整模型输入 token 数。 */
  tokens: number;
  /** heading：来源的章节标题路径，不随当前文档名称变化。 */
  heading: string[];
  /** source_spans：规范文本内的真实来源范围，可包含重复表头等不连续区间。 */
  source_spans: SourceSpan[]
}
/** ChunkPage 绑定同一生效版本的片段分页；无 active 时显式返回 unindexed。 */
export interface ChunkPage extends KnowledgePage<ChunkPreview> {
  /** status：查询结果语义状态，具体取值由所在响应类型定义。 */
  status: 'unindexed' | 'indexed';
  /** index_revision：独立索引修订号，清除和单篇构建使用此值进行比较更新。 */
  index_revision: number;
  /** index_version_id：执行条目或片段对应的索引版本；未分配时可为空。 */
  index_version_id: string | null
}
/** SearchInput 管理员检索验证输入，用户过滤条件不能扩大服务端授权范围。 */
export interface SearchInput {
  /** query：待检索的问题文本，不含模型查询前缀。 */
  query: string;
  /** book：Book 过滤：all 为全部，none 为独立文档，其他值为 Book ID。 */
  book: string;
  /** title：按当前标题进行大小写不敏感的字面量子串过滤。 */
  title: string;
  /** tag：规范化后精确匹配的单个标签。 */
  tag: string;
  /** top_k：过滤后最多返回的命中数量。 */
  top_k: number
}
/** SearchHit 可回溯文档、资产、索引版本与真实原文位置的完整检索命中。 */
export interface SearchHit {
  /** chunk_id：命中片段的稳定资源 ID。 */
  chunk_id: string;
  /** document_id：实际执行或命中的文档 ID。 */
  document_id: string;
  /** knowledge_base_id：当前所属知识库的 UUIDv7；Book 与文档关联必须同库。 */
  knowledge_base_id: string;
  /** source_asset_id：不可变原文件资产 ID，供恢复历史来源。 */
  source_asset_id: string;
  /** index_version_id：执行条目或片段对应的索引版本；未分配时可为空。 */
  index_version_id: string;
  /** profile_id：不可变 Embedding 档案 ID，不仅用于区分向量维度。 */
  profile_id: string;
  /** source_sha256：原始文件字节的 SHA-256，用于验证固定来源。 */
  source_sha256: string;
  /** canonical_sha256：解析后规范文本的 SHA-256，用于核对片段来源。 */
  canonical_sha256: string;
  /** title：当前文档标题；修改标题不会替换固定原文件。 */
  title: string;
  /** book_id：所属 Book；null 表示独立文档，不表示删除文档。 */
  book_id: string | null;
  /** book_name：当前 Book 名称；独立文档时为空。 */
  book_name: string | null;
  /** tags：规范化标签集合；去空、转小写并去重后保存。 */
  tags: string[];
  /** original_name：仅供展示和下载的原始文件名，不用于拼接服务器路径。 */
  original_name: string;
  /** ordinal：从零开始的片段顺序号，用于稳定排序和连续性校验。 */
  ordinal: number;
  /** text：规范化原文或片段正文，供来源定位和引用展示。 */
  text: string;
  /** tokens：包含前缀、上下文及特殊 token 的完整模型输入 token 数。 */
  tokens: number;
  /** heading：来源的章节标题路径，不随当前文档名称变化。 */
  heading: string[];
  /** source_spans：规范文本内的真实来源范围，可包含重复表头等不连续区间。 */
  source_spans: SourceSpan[];
  /** distance：余弦距离，越小越接近；不是答案正确概率。 */
  distance: number
}
/** SearchResult 成功检索结果，明确区分 found 和 no_matches；故障由请求错误表达。 */
export interface SearchResult {
  /** status：查询结果语义状态，具体取值由所在响应类型定义。 */
  status: 'found' | 'no_matches';
  /** profile_id：不可变 Embedding 档案 ID，不仅用于区分向量维度。 */
  profile_id: string;
  /** space_id：向量坐标空间 ID；相同维度不代表相同空间。 */
  space_id: string;
  /** hits：按距离、文档 ID、片段顺序排序的原始命中集合。 */
  hits: SearchHit[]
}

/** record：校验未知响应为非空、非数组的普通对象。 */
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** uuid：校验服务端资源 ID 为规范的小写 UUIDv7。 */
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)
/** nullableUUID：允许显式 null，其余值必须为合法的资源 UUIDv7。 */
const nullableUUID = (v: unknown) => v === null || uuid(v)
/** integer：校验非负安全整数，防止非法计数进入管理状态。 */
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
/** positive：校验严格大于零的安全整数。 */
const positive = (v: unknown): v is number => integer(v) && v > 0
/** timestamp：校验响应时间字段可被解析为有效时间。 */
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
/** strings：校验字符串数组，不接受混入其他值的响应。 */
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
/** mode：只接纳 build 与 force 两种已支持的命令意图。 */
const mode = (v: unknown): v is IndexMode => v === 'build' || v === 'force'
/** hash：校验小写十六进制 SHA-256 字符串。 */
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
/** counts：逐项验证任务状态计数为非负安全整数。 */
const counts = (v: unknown): v is IndexCounts => record(v) && ['total', 'queued', 'running', 'succeeded', 'failed', 'interrupted', 'skipped'].every(k => integer(v[k]))
/** optionalString：校验可省略的字符串字段。 */
const optionalString = (v: unknown) => v === undefined || typeof v === 'string'
/**
 * isItem 验证执行状态、版本标识和进度范围，不允许完成数大于总数。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isItem(v: unknown): v is IndexItem {
  return record(v) && uuid(v.id) && uuid(v.document_id) && ['queued', 'running', 'succeeded', 'failed', 'interrupted', 'skipped'].includes(String(v.state)) && typeof v.phase === 'string' && nullableUUID(v.index_version_id) && integer(v.completed_chunks) && integer(v.total_chunks) && v.completed_chunks <= v.total_chunks && optionalString(v.error_code) && optionalString(v.error_message) && timestamp(v.created_at) && timestamp(v.updated_at)
}
/** 拒绝非法的可选索引摘要，避免缺失 busy 或修订信息时错误启用破坏性操作。 */
/** @param v 请求边界收到的未知值，必须通过守卫后才能使用。 */
export function isIndexSummary(v: unknown): v is IndexSummary {
  return record(v) && positive(v.index_revision) && nullableUUID(v.active_version_id) && nullableUUID(v.profile_id) && integer(v.chunk_count) && typeof v.busy === 'boolean' && (v.item === undefined || isItem(v.item)) && (v.recent_terminal === undefined || isItem(v.recent_terminal)) && (v.recent_job_id === undefined || uuid(v.recent_job_id)) && (v.recent_mode === undefined || mode(v.recent_mode)) && (!v.busy || isItem(v.item) && ['queued', 'running'].includes(v.item.state))
}
/**
 * isJob 校验任务头部、模式、聚合状态及成员计数。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isJob(v: unknown): v is IndexJob {
  return record(v) && uuid(v.id) && mode(v.mode) && ['queued', 'running', 'succeeded', 'completed_with_errors', 'interrupted'].includes(String(v.state)) && counts(v.counts) && timestamp(v.created_at) && (v.origin_job_id === undefined || uuid(v.origin_job_id))
}
/**
 * isJobItem 在执行条目基础上验证来源与共享次数。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isJobItem(v: unknown): v is IndexJobItem { return isItem(v) && record(v) && typeof v.title === 'string' && uuid(v.knowledge_base_id) && typeof v.document_deleted === 'boolean' && positive(v.shared_job_count) }
/**
 * isRuntime 验证运行开关、档案标识、服务修订和全局队列计数。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isRuntime(v: unknown): v is IndexRuntimeState { return record(v) && ['ready', 'worker_enabled', 'accepting', 'retrieval_enabled', 'retrieval_ready'].every(k => typeof v[k] === 'boolean') && typeof v.reason === 'string' && nullableUUID(v.profile_id) && nullableUUID(v.space_id) && nullableUUID(v.config_id) && integer(v.dimension) && integer(v.serving_revision) && integer(v.queued) && integer(v.running) && timestamp(v.observed_at) }
/**
 * spans 验证非空真实来源区间，结束偏移必须大于起始偏移。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function spans(v: unknown): v is SourceSpan[] { return Array.isArray(v) && v.length > 0 && v.every(s => record(s) && integer(s.start) && integer(s.end) && s.end > s.start && ['line_start', 'line_end', 'page', 'paragraph', 'table', 'row'].every(k => s[k] === undefined || positive(s[k]))) }
/**
 * isChunk 验证片段顺序、完整输入 token 预算和真实来源定位。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isChunk(v: unknown): v is ChunkPreview { return record(v) && uuid(v.id) && integer(v.ordinal) && v.ordinal < 4096 && typeof v.text === 'string' && positive(v.tokens) && v.tokens <= 512 && strings(v.heading) && spans(v.source_spans) }
/**
 * isHit 验证可追溯命中的完整身份、来源摘要与有限距离值。
 * @param v 请求边界收到的未知值，必须通过守卫后才能使用。
 */
function isHit(v: unknown): v is SearchHit { return record(v) && ['chunk_id', 'document_id', 'knowledge_base_id', 'source_asset_id', 'index_version_id', 'profile_id'].every(k => uuid(v[k])) && hash(v.source_sha256) && hash(v.canonical_sha256) && typeof v.title === 'string' && nullableUUID(v.book_id) && (v.book_name === null || typeof v.book_name === 'string') && strings(v.tags) && typeof v.original_name === 'string' && integer(v.ordinal) && typeof v.text === 'string' && positive(v.tokens) && v.tokens <= 512 && strings(v.heading) && spans(v.source_spans) && typeof v.distance === 'number' && Number.isFinite(v.distance) }
/**
 * page 将单项类型守卫组合为索引分页响应守卫。
 * @param guard 将未知值收窄为目标类型的响应守卫。
 */
function page<T>(guard: (v: unknown) => v is T) { return (v: unknown): v is KnowledgePage<T> => record(v) && Array.isArray(v.items) && v.items.every(guard) && optionalString(v.next_cursor) }
/**
 * queryString 编码有值的分页与过滤参数，省略 undefined 和空字符串。
 * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
 */
function queryString(query: KnowledgeQuery = {}) { const p = new URLSearchParams(); for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') p.set(k, String(v)); return p.size ? `?${p}` : '' }

/** POST/DELETE 明确禁用客户端认证刷新后的自动重放。调用方保留幂等键，仅在人工核对时重放完全相同的请求。 */
export class AgentIndexAdminApi {
  /**
   * constructor 注入 V2 客户端，默认复用应用请求实例，也便于测试替换。
   * @param client 供注入的 V2 请求客户端，默认复用应用实例。
   */
  constructor(private readonly client: ClientV2 = clientV2) {}
  /**
   * checked 发送请求后验证未知响应；读取允许现有认证恢复，写入禁止自动重放。
   * @param path 索引管理前缀下的相对资源路径。
   * @param guard 将未知值收窄为目标类型的响应守卫。
   * @param init 请求方法、请求体和取消信号等选项。
   */
  private async checked<T>(path: string, guard: (v: unknown) => v is T, init?: RequestInit): Promise<T> {
    const value: unknown = await this.client.request(`/admin/agent${path}`, init, !init?.method || init.method === 'GET')
    if (!guard(value)) throw new Error('索引响应无效，请刷新核对任务结果')
    return value
  }
  /**
   * runtime 读取当前部署状态与全局在途计数。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  runtime(signal?: AbortSignal) { return this.checked('/index-runtime', isRuntime, { signal }) }
  /**
   * jobs 读取管理命令聚合分页。
   * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  jobs(query?: KnowledgeQuery, signal?: AbortSignal) { return this.checked(`/index-jobs${queryString(query)}`, page(isJob), { signal }) }
  /**
   * job 读取管理命令详情及不可变目标快照。
   * @param id 要读取详情的持久化 job UUIDv7。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  job(id: string, signal?: AbortSignal) { return this.checked(`/index-jobs/${encodeURIComponent(id)}`, (v): v is IndexJobDetail => isJob(v) && record(v) && record(v.command) && record(v.target_snapshot), { signal }) }
  /**
   * items 读取指定 job 的实际执行成员分页。
   * @param id 需要读取成员分页的来源 job UUIDv7。
   * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  items(id: string, query?: KnowledgeQuery, signal?: AbortSignal) { return this.checked(`/index-jobs/${encodeURIComponent(id)}/items${queryString(query)}`, page(isJobItem), { signal }) }
  /**
   * document 提交单篇构建，携带独立索引修订与调用方幂等键。
   * @param id 要提交构建的文档 UUIDv7。
   * @param revision 预期索引修订号，与元数据修订独立。
   * @param mode 原始 build/force 构建意图。
   * @param key 本次冻结命令的幂等键，结果不确定时须复用。
   */
  document(id: string, revision: number, mode: IndexMode, key: string) { return this.checked(`/documents/${encodeURIComponent(id)}/index-jobs`, isJob, { method: 'POST', body: JSON.stringify({ client_request_id: key, mode, expected_index_revision: revision }) }) }
  /**
   * book 提交一个 Book 的构建命令，文档范围由服务端在提交时快照展开。
   * @param id 需要快照展开文档范围的 Book UUIDv7。
   * @param mode 原始 build/force 构建意图。
   * @param key 本次冻结命令的幂等键，结果不确定时须复用。
   */
  book(id: string, mode: IndexMode, key: string) { return this.checked(`/books/${encodeURIComponent(id)}/index-jobs`, isJob, { method: 'POST', body: JSON.stringify({ client_request_id: key, mode }) }) }
  /**
   * books 复制选中 Book ID 后提交批量构建，防止等待期间界面修改目标数组。
   * @param ids 提交时固定的多个 Book ID，不能随界面选择变化。
   * @param mode 原始 build/force 构建意图。
   * @param key 本次冻结命令的幂等键，结果不确定时须复用。
   */
  books(ids: string[], mode: IndexMode, key: string) { return this.checked('/index-jobs', isJob, { method: 'POST', body: JSON.stringify({ client_request_id: key, mode, book_ids: [...ids] }) }) }
  /**
   * retry 重试失败或中断条目，显式提供来源 job 以继承其 build/force 意图。
   * @param itemId 要重试的失败或中断执行条目 ID。
   * @param originJobId 重试来源任务，服务端据此校验成员关系并继承构建意图。
   * @param key 本次冻结命令的幂等键，结果不确定时须复用。
   */
  retry(itemId: string, originJobId: string, key: string) { return this.checked(`/index-job-items/${encodeURIComponent(itemId)}/retry`, isJob, { method: 'POST', body: JSON.stringify({ client_request_id: key, origin_job_id: originJobId }) }) }
  /**
   * clear 用索引修订进行比较清除，返回最新索引摘要，保留原文件及历史文本。
   * @param id 要清除生效索引的文档 UUIDv7。
   * @param revision 预期索引修订号，与元数据修订独立。
   */
  async clear(id: string, revision: number) {
    const result = await this.checked(`/documents/${encodeURIComponent(id)}/index`, (v): v is {
  /** index：可选索引摘要；区分当前生效版本与正在执行的构建。 */
  index: IndexSummary
} => record(v) && isIndexSummary(v.index), { method: 'DELETE', body: JSON.stringify({ index_revision: revision }) })
    return result.index
  }
  /**
   * chunks 读取当前 active 的原文片段分页，分页游标由服务端绑定版本。
   * @param id 需要预览当前 active 原文片段的文档 UUIDv7。
   * @param query 分页及元数据过滤条件；省略时使用服务端默认值。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  chunks(id: string, query?: KnowledgeQuery, signal?: AbortSignal) { return this.checked(`/documents/${encodeURIComponent(id)}/chunks${queryString(query)}`, (v): v is ChunkPage => page(isChunk)(v) && record(v) && ['indexed', 'unindexed'].includes(String(v.status)) && positive(v.index_revision) && nullableUUID(v.index_version_id), { signal }) }
  /**
   * search 执行管理员检索验证；零命中与依赖失败分别处理，不生成模型回答。
   * @param id 本次检索唯一目标知识库 UUIDv7，授权范围仍由服务端确定。
   * @param input 本次固定的问题、Book、标题、标签和 top-k 过滤快照。
   * @param signal 只读请求的取消信号，取消读取不取消已接纳的服务端任务。
   */
  search(id: string, input: SearchInput, signal?: AbortSignal) { return this.checked(`/knowledge-bases/${encodeURIComponent(id)}/search`, (v): v is SearchResult => record(v) && ['found', 'no_matches'].includes(String(v.status)) && uuid(v.profile_id) && uuid(v.space_id) && Array.isArray(v.hits) && v.hits.every(isHit) && (v.status === 'found' ? v.hits.length > 0 : v.hits.length === 0), { method: 'POST', body: JSON.stringify(input), signal }) }
}
/** agentIndexAdminApi：应用共用的索引与检索管理 API 实例。 */
export const agentIndexAdminApi = new AgentIndexAdminApi()
