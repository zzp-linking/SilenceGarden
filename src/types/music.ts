export interface MusicCatalogItem {
  _id: string
  name: string
  album?: string
  tag: string[]
  disk_img: string
}

export interface Music extends MusicCatalogItem {
  src: string
  bg_img: string
}

export interface MelodyDetail {
  melody: Music
  last: string
  next: string
}

export const emptyMusic = (): Music => ({
  _id: '',
  name: '',
  tag: [],
  src: '',
  disk_img: '',
  bg_img: ''
})
