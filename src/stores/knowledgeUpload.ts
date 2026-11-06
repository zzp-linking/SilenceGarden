import { defineStore } from 'pinia'

/** KnowledgeUploadDefaults 本标签页按知识库隔离的成功上传偏好，不保存标题或原文件。 */
export interface KnowledgeUploadDefaults {
  /** tags：规范化标签集合；去空、转小写并去重后保存。 */
  tags: string[];
  /** book_id：所属 Book；null 表示独立文档，不表示删除文档。 */
  book_id: string | null
}

/** 仅保存本标签页内的上传偏好；不持久化文件、标题或浏览器存储。
 * Book 属于特定知识库，因此标签/归属按知识库隔离，避免跨库误用 ID。 */
export const useKnowledgeUploadStore = defineStore('knowledgeUpload', {
  // 每个知识库保存独立偏好，内存只属于当前浏览器标签页，不写入持久存储。
  state: () => ({ byBase: {} as Record<string, KnowledgeUploadDefaults> }),
  actions: {
    /** 返回独立草稿，取消或编辑表单不会改写上一次成功配置。 */
    /** @param baseId 上传偏好所属的知识库 ID，防止跨库复用 Book。 */
    defaultsFor(baseId: string): KnowledgeUploadDefaults {
      const value = this.byBase[baseId]
      return { tags: [...(value?.tags ?? [])], book_id: value?.book_id ?? null }
    },
    /** 只在服务端确认上传成功后调用；显式清空标签/归属也需要记住。 */
    /**
     * @param baseId 上传偏好所属的知识库 ID，防止跨库复用 Book。
     * @param value 需要校验、保存或操作的当前数据快照。
     */
    remember(baseId: string, value: KnowledgeUploadDefaults) {
      this.byBase[baseId] = { tags: [...value.tags], book_id: value.book_id }
    },
    /** 本页解散 Book 成功后清掉失效归属，仍保留上次标签。 */
    /**
     * @param baseId 上传偏好所属的知识库 ID，防止跨库复用 Book。
     * @param bookId 已在本页成功解散的 Book ID。
     */
    forgetBook(baseId: string, bookId: string) {
      const value = this.byBase[baseId]
      if (value?.book_id === bookId) this.byBase[baseId] = { tags: [...value.tags], book_id: null }
    }
  }
})
