<template>
  <div class="container" @touchstart="bgmplay" @click="bgmplay">
    <audio src="/assets/audio/汐.mp3" ref="bgm" autoplay loop></audio>

    <a-row type="flex" justify="space-around" class="animate__animated animate__fadeInDown">
      <a-col class="col" :xs="20" :sm="12">
        <router-link to="/article" class="item skill">
          <span>纵使困顿难行，亦当砥砺奋进</span>
        </router-link>
      </a-col>
    </a-row>

    <a-row type="flex" justify="space-around" class="animate__animated animate__fadeInDown" :style="{ animationDelay: '.4s' }">
      <a-col class="col" :xs="20" :sm="12">
        <router-link to="/poetry" class="item poetry">
          <span>今日默书，方恨千卷诗书未能全记</span>
        </router-link>
      </a-col>
    </a-row>

    <a-row type="flex" justify="space-around" class="animate__animated animate__fadeInDown" :style="{ animationDelay: '.8s' }">
      <a-col class="col" :xs="20" :sm="12">
        <router-link to="/violin" class="item violin">
          <span>再抚琴，早已咫尺天涯…</span>
        </router-link>
      </a-col>
    </a-row>

    <a-row type="flex" justify="space-around" class="animate__animated animate__fadeInDown" :style="{ animationDelay: 1.2 }">
      <a-col class="col" :xs="20" :sm="12">
        <router-link to="/poetry" class="item kawayi">
          <span>生人勿进( • ̀ω•́ )✧</span>
        </router-link>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const bgm = ref(null)

const bgmplay = () => {
  if (bgm.value && bgm.value.paused) {
    bgm.value.play().catch(err => {
      // 浏览器可能拦截自动播放，这是正常的
      console.log('BGM play blocked or failed:', err)
    })
  }
}

onMounted(() => {
  document.addEventListener("WeixinJSBridgeReady", () => {
    bgmplay()
  }, false)
})
</script>

<style lang="less" scoped>
@import '@/config/base.less';

.skill {
  background-image: url(/assets/image/common/skill-bg.png);
}
.poetry {
  background-image: url(/assets/image/common/poetry-bg.png);
}
.violin {
  background-image: url(/assets/image/common/violin-bg.png);
}
.kawayi {
  background-image: url(/assets/image/common/kawayi-bg.png);
}

.container {
  min-height: 100vh;
  background-image: url(/assets/image/common/home-bg.jpg);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  padding-top: 10vh;
  background-attachment: fixed;
  font-family: @poem;
}

.col {
  margin: 20px auto;
}

.item {
  display: block;
  background-color: rgba(0, 0, 0, 0.3);
  min-height: 80px;
  line-height: 80px;
  font-size: 36px;
  font-family: @poem; // 显式指定字体，防止被全局样式覆盖
  border-radius: @bbr;
  text-align: left;
  padding-left: 2em;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: right;
  opacity: 0.9;
  box-shadow: none;
  transition: all 0.3s;
  text-decoration: none;
}

.item:hover {
  cursor: pointer;
  box-shadow: 0 0 10px red, 0 0 5px blue;
  background-color: rgba(255, 255, 255, 0.3);
}

.item span {
  color: #fff;
  transition: all 0.5s;
  letter-spacing: 0.2em;
  font-style: inherit;
}

.item:hover span {
  background: linear-gradient(to right, red, blue);
  -webkit-background-clip: text;
  color: transparent;
  letter-spacing: 0.5em;
  font-style: italic;
}

@media only screen and (max-width: @threshold) {
  .container {
    background-image: url(/assets/image/common/m-home-bg.jpg);
  }
  .item {
    font-size: 18px;
    min-height: 50px;
    line-height: 50px;
    padding-left: 0.5em;
  }
  .item span {
    letter-spacing: 0em;
    text-shadow: 0 0 5px #000;
  }
  .item:hover span {
    letter-spacing: 0.2em;
    color: #2db7f5;
    text-shadow: none;
  }
  .container {
    padding-top: 5vh;
  }
  .col {
    margin: 10px auto;
  }
}
</style>
