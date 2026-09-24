import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_MELODY, GET_MELODY_CATALOG, GET_MELODY_RANDOM } from '@/config/url'
import router from '@/router'
import { useGlobalStore } from './global'
import type { IdParams } from '@/types/api'
import { emptyMusic, type MelodyDetail, type Music, type MusicCatalogItem } from '@/types/music'

interface ViolinState {
  catalog: MusicCatalogItem[]
  melody: Music
  last: string
  next: string
}

export const useViolinStore = defineStore('violin', {
  state: (): ViolinState => ({ catalog: [], melody: emptyMusic(), last: '', next: '' }),
  actions: {
    /** 加载小提琴曲目目录。 */
    async getVillinCatalog(): Promise<void> {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const list = await net.get<MusicCatalogItem[]>(GET_MELODY_CATALOG)
        if (Array.isArray(list)) this.catalog = list
      } finally {
        globalStore.setLoading(false)
      }
    },
    /** 进入播放页前清空上一首曲目的播放和导航信息。 */
    violinInint(): void {
      this.melody = emptyMusic()
      this.last = ''
      this.next = ''
    },
    /** 加载当前曲目以及前后曲目 ID。 */
    async getViolinInfo(params: IdParams): Promise<void> {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const result = await net.get<MelodyDetail>(restful(GET_MELODY, params))
        if (result) {
          this.melody = result.melody
          this.last = result.last
          this.next = result.next
        }
      } finally {
        globalStore.setLoading(false)
      }
    },
    /** 请求一首随机曲目，并通过路由跳转触发统一的详情加载。 */
    async getRamdonViolinInfo(params: IdParams): Promise<void> {
      const result = await net.get<Music>(restful(GET_MELODY_RANDOM, params))
      if (result?._id) void router.push(`/violin/${result._id}`)
    }
  }
})
