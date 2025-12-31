import { defineStore } from 'pinia'
import net, { restful } from '@/utils/net'
import { GET_MELODY, GET_MELODY_CATALOG, GET_MELODY_RANDOM } from '@/config/url'
import router from '@/router'
import { useGlobalStore } from './global'

export const useViolinStore = defineStore('violin', {
  state: () => ({
    catalog: [],
    melody: {
      name: '',
      src: '',
      disk_img: '',
      bg_img: ''
    },
    last: '', // 上一曲
    next: '', // 下一曲
  }),
  actions: {
    async getVillinCatalog() {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const list = await net.get(GET_MELODY_CATALOG)
        if (list) {
          this.catalog = list
        }
      } catch (e) {
        console.error(e)
      } finally {
        globalStore.setLoading(false)
      }
    },
    violinInint() {
      this.melody = {
        name: '',
        src: '',
        disk_img: '',
        bg_img: ''
      }
      this.last = ''
      this.next = ''
    },
    async getViolinInfo(obj) {
      const globalStore = useGlobalStore()
      globalStore.setLoading(true)
      try {
        const res = await net.get(restful(GET_MELODY, obj))
        if (res) {
          this.melody = res.melody
          this.last = res.last
          this.next = res.next
        }
      } catch (error) {
        console.error(error)
      } finally {
        globalStore.setLoading(false)
      }
    },
    async getRamdonViolinInfo(obj) {
      try {
        const res = await net.get(restful(GET_MELODY_RANDOM, obj))
        if (res && res._id) {
          router.push(`/violin/${res._id}`)
        }
      } catch (error) {
        console.error(error)
      }
    }
  }
})

