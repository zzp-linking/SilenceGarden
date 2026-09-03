<template>
  <div class="violin-wrap" @keyup.space.prevent="playPause" tabindex="-1" ref="page">
    <div class="violin-bg-content">
      <img class="vioin-bg-img" :src="diskBGImg" :class="{ 'vioin-bg-img-blur': !paused }" alt="bg">
    </div>
    <div class="container">
      <div class="title">{{ title }}</div>

      <!-- 音频控件 -->
      <audio 
        ref="music" 
        :src="aud" 
        @play="startPlay" 
        @pause="pauseListener" 
        @ended="playEnded" 
        :autoplay="true"
      ></audio>

      <div class="violin-content">
        <div class="disc">
          <div class="disc-bg"></div>
          <img :src="discImg" class="melody-disk" :class="{ 'melody-pause': paused }" @click.prevent="" alt="disk" />
          <div v-if="isPc()" :style="lightScale" class="disk-light" :class="{ 'disk-light-show': !paused }"></div>
          <div 
            v-if="isPc()" 
            class="disk-controller" 
            :class="{ 'disk-controller-transition': !pointer.flag }"
            :style="{ transform: 'rotate(' + controllerRotate + 'deg)' }"
          ></div>
        </div>
        <div class="time-content clearfix">
          <div class="slider-wrap" @mousedown="stopClock" @mouseup="awakenClock" @touchstart="stopClock" @touchend="awakenClock">
            <a-slider 
              v-model:value="current" 
              :max="max" 
              :step="0.01" 
              :tip-formatter="playTimeFormat" 
              @change="currentSet" 
              class="violin-slider"
            />
          </div>
          <span class="time-show">{{ playTimeFormat(current) }} / {{ playTimeFormat(during) }}</span>
        </div>
      </div>

      <!-- 播放控制组件 -->
      <div class="controller">
        <div class="melody-exchange">
          <router-link to="/violin" style="color: #000;">
            <appstore-outlined />
          </router-link>
        </div>
        <div class="single-circle melody-exchange" @click="playModelChange('single')">
          <div class="play-model-wrap">
            <sync-outlined :class="{ 'active-icon': model === 'single' }" />
            <div class="play-model-bg" :class="{ 'play-model-on-bg': model === 'single' }"></div>
          </div>
        </div>
        <div @click="changeMusic(last, 'last')" class="melody-exchange-box last melody-exchange">
          <left-outlined />
        </div>
        <div @click="playPause" class="play-pause">
          <play-circle-outlined v-show="paused" />
          <pause-circle-outlined v-show="!paused" />
        </div>
        <div @click="changeMusic(next, 'next')" class="melody-exchange-box next melody-exchange">
          <right-outlined />
        </div>
        <div class="melody-exchange">
          <a-tooltip placement="top">
            <template #title>
              <div style="width: 100px;">
                <a-slider v-model:value="volume" :max="1" :step="0.01" :min="0" @change="volumnSet" />
              </div>
            </template>
            <sound-outlined v-show="volume != 0" />
            <audio-muted-outlined v-show="volume == 0" />
          </a-tooltip>
        </div>
        <div class="random-play melody-exchange" @click="playModelChange('random')">
          <div class="play-model-wrap">
            <swap-outlined :class="{ 'active-icon': model === 'random' }" />
            <div class="play-model-bg" :class="{ 'play-model-on-bg': model === 'random' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'
import { useViolinStore } from '@/store/violin'
import { isPc } from '@/utils/tool'
import { message } from '@/utils/talk'
import { IMG, AUDIO } from '@/config/url'
import router from '@/router'
import {
  AppstoreOutlined,
  SyncOutlined,
  LeftOutlined,
  RightOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  SwapOutlined
} from '@ant-design/icons-vue'

const route = useRoute()
const violinStore = useViolinStore()
const music = ref<HTMLAudioElement | null>(null)

const paused = ref(true)
const during = ref(0)
const current = ref(0)
const volume = ref(1)
const clock = ref<ReturnType<typeof setInterval> | null>(null)
const max = ref(0)
const model = ref('') // single, random

const pointer = reactive({
  init_value: -30,
  flag: false
})

const current_src = ref('')

const aud = computed(() => {
  const store_src = violinStore.melody.src
  const src = store_src || current_src.value
  if (store_src) current_src.value = store_src
  return `${AUDIO}/${src}`
})

const discImg = computed(() => {
  let img = violinStore.melody.disk_img || '四月是你的谎言-disk.png'
  return `${IMG}/violin/${img}`
})

const diskBGImg = computed(() => {
  let img = violinStore.melody.bg_img || '四月是你的谎言-bg.jpg'
  return `${IMG}/violin/${img}`
})

const title = computed(() => violinStore.melody.name)
const last = computed(() => violinStore.last)
const next = computed(() => violinStore.next)

const lightScale = computed(() => {
  if (!during.value) return {}
  const scale = 1.17 - (current.value / during.value) * 0.4
  const rotate = (current.value / during.value) * 12 - 6
  return { transform: `scale(${scale}) rotate(${rotate}deg)` }
})

const controllerRotate = computed(() => {
  if (paused.value) return -30
  if (pointer.flag) {
    return (current.value / during.value) * 11.2 - 4.6
  } else {
    return (pointer.init_value / during.value) * 11.2 - 4.6
  }
})

onMounted(() => {
  violinStore.violinInint()
  const idParam = route.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  if (id) void violinStore.getViolinInfo({ id })
  
  if (music.value) {
    music.value.addEventListener('loadedmetadata', () => {
      initPlayer()
    })
  }
})

onBeforeRouteUpdate(to => {
  const idParam = to.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  if (id) void violinStore.getViolinInfo({ id })
})

onUnmounted(() => {
  stopClock()
})

const initPlayer = (): void => {
  if (!music.value) return
  max.value = music.value.duration
  during.value = music.value.duration
  paused.value = music.value.paused
}

const startPlay = (): void => {
  if (!music.value) return
  pointer.init_value = music.value.currentTime
  paused.value = false
  startClock()
  setTimeout(() => {
    pointer.flag = true
  }, 800)
}

const pauseListener = (): void => {
  pointer.flag = false
  paused.value = true
}

const playEnded = (): void => {
  if (!music.value) return
  if (model.value === 'single') {
    void music.value.play()
  } else if (model.value === 'random') {
    stopClock()
    paused.value = true
    const idParam = route.params.id
    const id = Array.isArray(idParam) ? idParam[0] : idParam
    if (id) void violinStore.getRamdonViolinInfo({ id })
  } else {
    stopClock()
    paused.value = true
  }
}

const playPause = (): void => {
  if (!music.value) return
  if (music.value.paused) {
    void music.value.play()
  } else {
    music.value.pause()
  }
  paused.value = music.value.paused
}

const startClock = (): void => {
  if (!music.value) return
  stopClock()
  clock.value = setInterval(() => {
    current.value = music.value?.currentTime || 0
  }, 30)
}

const stopClock = (): void => {
  if (clock.value) clearInterval(clock.value)
  clock.value = null
}

const awakenClock = (): void => {
  stopClock()
  startClock()
}

const currentSet = (val: number | string): void => {
  if (!music.value) return
  music.value.currentTime = Number(val)
  startClock()
}

const volumnSet = (val: number | string): void => {
  const nextVolume = Number(val)
  volume.value = nextVolume
  if (music.value) music.value.volume = nextVolume
}

const playTimeFormat = (value?: number): string => {
  if (!value) return '00 : 00'
  const minutes = String(Math.floor(value / 60)).padStart(2, '0')
  const seconds = String(Math.floor(value % 60)).padStart(2, '0')
  return `${minutes} : ${seconds}`
}

const playModelChange = (val: 'single' | 'random'): void => {
  model.value = model.value === val ? '' : val
}

const changeMusic = (id: string, type: 'last' | 'next'): void => {
  if (!id) {
    message(type === 'last' ? '前面什么也没有┐(´∀｀)┌！' : '已经是最后一首啦ヽ(`Д´)ﾉ！', 4)
  } else {
    message('切歌[]~(￣▽￣)~*！', 2)
    router.push(`/violin/${id}`)
  }
}
</script>

<style scoped lang="less">
@import '@/config/base.less';

.violin-wrap {
  min-height: 100vh;
  position: relative;
  outline: none;
}

.violin-bg-content {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  overflow: hidden;
  
  .vioin-bg-img {
    filter: blur(0);
    width: 110%;
    height: 110%;
    object-fit: cover;
    margin: -5% -5%;
    transition: filter 0.8s ease;
  }
  
  .vioin-bg-img-blur {
    filter: blur(16px);
  }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.title {
  text-align: center;
  font-size: 60px;
  font-family: @poem;
  color: #fff;
  text-shadow: 0 0 10px rgba(0,0,0,0.5);
  margin-bottom: 40px;
}

.violin-content {
  margin-top: 60px;
}

.disc {
  position: relative;
  width: 490px;
  height: 490px;
  margin: 0 auto;
  
  .disc-bg {
    width: 100%;
    height: 100%;
    background-image: url(/home/assets/image/violin/disk.png);
    background-size: cover;
    position: absolute;
    top: 0;
    left: 0;
  }
  
  .melody-disk {
    position: absolute;
    width: 100%;
    height: 100%;
    animation: roll 10s linear infinite;
    &.melody-pause {
      animation-play-state: paused;
    }
  }
  
  .disk-light {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    background-image: url(/home/assets/image/violin/disk-light.png);
    background-size: cover;
    transition: opacity 0.8s;
    &.disk-light-show {
      opacity: 1;
    }
  }
  
  .disk-controller {
    position: absolute;
    width: 259px;
    height: 527px;
    right: -107px;
    top: -94px;
    background-image: url(/home/assets/image/violin/disk-controllerArm.png);
    background-size: cover;
    transform-origin: 83.78% 11.2%;
    transition: transform 0.5s;
  }
}

.time-content {
  margin-top: 40px;
  display: flex;
  align-items: center;
  gap: 20px;
  
  .slider-wrap {
    flex: 1;
  }
  
  .time-show {
    color: #fff;
    font-size: 14px;
    background: rgba(0,0,0,0.3);
    padding: 2px 10px;
    border-radius: 10px;
  }
}

.controller {
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 400px;
  margin: 40px auto;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 10px;
  border-radius: 35px;
  opacity: 0.6;
  transition: opacity 0.3s;
  
  &:hover {
    opacity: 1;
  }
}

.melody-exchange {
  font-size: 24px;
  cursor: pointer;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  transition: color 0.3s;
  
  &:hover {
    color: #000;
  }
  
  .active-icon {
    color: #98FB98;
  }
}

.play-pause {
  font-size: 48px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.1);
  }
}

@keyframes roll {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media only screen and (max-width: @threshold) {
  .title {
    font-size: 32px;
  }
  .disc {
    width: 80vw;
    height: 80vw;
  }
  .controller {
    width: 90%;
  }
}

// 覆写 Antd Slider 样式
:deep(.ant-slider) {
  .ant-slider-rail { background-color: rgba(255,255,255,0.2); }
  .ant-slider-track { background-color: #4F4F4F; }
  .ant-slider-handle { 
    background-color: #383838;
    border-color: #383838;
  }
}
</style>

