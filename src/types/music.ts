/** 小提琴音乐目录中的轻量条目。 */
export interface MusicCatalogItem {
  /** MongoDB 音乐记录 ID。 */
  _id: string
  /** 曲目名称。 */
  name: string
  /** 所属专辑名称。 */
  album?: string
  /** 用于分类展示的标签列表。 */
  tag: string[]
  /** 唱片旋转区域使用的封面图片文件名。 */
  disk_img: string
}

/** 播放页使用的完整音乐信息。 */
export interface Music extends MusicCatalogItem {
  /** 音频资源文件名或相对地址。 */
  src: string
  /** 播放页背景图片文件名。 */
  bg_img: string
}

/** 一首曲目及其前后导航信息。 */
export interface MelodyDetail {
  /** 当前播放曲目的完整信息。 */
  melody: Music
  /** 上一首曲目的记录 ID。 */
  last: string
  /** 下一首曲目的记录 ID。 */
  next: string
}

/** 创建播放器初始化使用的空曲目信息。 */
export const emptyMusic = (): Music => ({ _id: '', name: '', tag: [], src: '', disk_img: '', bg_img: '' })
