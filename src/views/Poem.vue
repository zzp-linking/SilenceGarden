<template>
  <div class="poem-page" :style="bgimage">
    <div class="wrap animate__animated animate__fadeIn">
      <div class="title">{{ poem.title }}</div>
      
      <div v-if="section" class="content">
        <section v-for="list in content" :key="list.id" class="section">
          <span 
            v-for="(item, index) in list" 
            :key="index" 
            class="sentence" 
            :class="poem.type === 'poem' ? 'poem' : 'essay'"
          >
            {{ item }}
          </span>
        </section>
      </div>
      <div v-else class="content">
        <section class="section">
          <span 
            v-for="(item, index) in content" 
            :key="index" 
            class="sentence" 
            :class="poem.type === 'poem' ? 'poem' : 'essay'"
          >
            {{ item }}
          </span>
        </section>
      </div>

      <div class="back-two">
        <span @click="goBack" class="back-link-two">
          <undo-outlined />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePoetryStore } from '@/store/poetry'
import { IMG } from '@/config/url'
import { isPc } from '@/utils/tool'
import { UndoOutlined } from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()
const poetryStore = usePoetryStore()

const goBack = () => {
  router.back()
}

const poem = computed(() => poetryStore.poem)
const section = computed(() => poetryStore.poem.section)
const content = computed(() => poetryStore.poem.content)

const bgimage = computed(() => {
  if (poem.value.img && poem.value.img.length > 0) {
    const path = IMG + '/poem-bg/'
    return {
      backgroundImage: isPc() ? `url(${path + poem.value.img[0]})` : `url(${path + poem.value.img[1]})`
    }
  } else {
    return {}
  }
})

onMounted(() => {
  const title = route.params.title
  if (title) {
    poetryStore.getPoemByTitle({ title })
  }
})
</script>

<style scoped lang="less">
@import '@/config/base.less';

.poem-page {
  color: #000;
  height: 100vh;
  overflow: auto;
  background-image: url(/assets/image/poem-bg/poem-default.jpg);
  background-repeat: no-repeat;
  background-size: cover;
  background-attachment: fixed;
  font-family: @poem;
}

.wrap {
  max-width: 1000px;
  margin: 50px auto;
  padding: 40px;
  border-radius: @bbr;
  position: relative;
  background-color: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(2px);
  min-height: 80vh;
}

.title {
  display: block;
  text-align: center;
  font-size: 48px;
  margin-bottom: 40px;
}

.content {
  font-size: 36px;
  text-shadow: 0 0 1em gainsboro;
}

.section {
  margin-bottom: 1.5em;
}

.sentence {
  display: block;
  line-height: 1.6;
}

.poem {
  text-align: center;
}

.essay {
  text-indent: 2em;
}

.back-two {
  position: fixed;
  top: 50px;
  right: 50px;
  z-index: 10;
}

.back-link-two {
  font-size: 50px;
  color: #5b6270;
  transition: all 0.3s;
  cursor: pointer;
  &:hover {
    color: @secondary;
    transform: rotate(-45deg);
  }
}

@media only screen and (max-width: @threshold) {
  .poem-page {
    background-image: url(/assets/image/poem-bg/poem-default-m.jpg);
  }
  .wrap {
    width: 94%;
    margin-top: 60px;
    padding: 20px 10px;
  }
  .title {
    font-size: 32px;
  }
  .content {
    font-size: 20px;
  }
  .back-two {
    top: 15px;
    right: 15px;
  }
  .back-link-two {
    font-size: 32px;
  }
}
</style>

