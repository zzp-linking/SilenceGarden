<template>
  <div class="article-page">
    <div class="article-wrap" :class="{ 'forbidden-scroll': modalImgOpen }">
      <div class="article-container">
        <h2 class="title">{{ article.title }}</h2>
        <div class="tags">
          <a-tag v-for="item in article.tags" :key="item" color="orange">{{ item }}</a-tag>
        </div>
        <div class="time">{{ article.time }}</div>
        <div 
          class="article-content-s markdown-body" 
          @click="contentClick" 
          v-html="html"
        ></div>
      </div>
    </div>

    <!-- 图片查看器 -->
    <div v-if="modalImgOpen" class="img-modal open" @click="modalImgOpen = false">
      <img class="modal-image" :src="modalImg" alt="preview">
    </div>

    <!-- 全局加载 -->
    <Loading :loading="loading" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useArticleStore } from '@/store/article'
import { isPc } from '@/utils/tool'
import Loading from '@/components/Loading.vue'
import 'github-markdown-css/github-markdown.css'
import 'highlight.js/styles/github.css'

const route = useRoute()
const articleStore = useArticleStore()

const modalImgOpen = ref(false)
const modalImg = ref('')

const article = computed(() => articleStore.article)
const html = computed(() => articleStore.article.html || '')
const loading = computed(() => articleStore.get_article_loading)

onMounted(() => {
  const id = route.params.id
  if (id) {
    articleStore.getArticleDetails({ id })
  }
})

const contentClick = (e) => {
  const nodeName = e.target.nodeName
  if (isPc() && nodeName === 'IMG') {
    modalImg.value = e.target.getAttribute('src')
    modalImgOpen.value = true
  }
}
</script>

<style scoped lang="less">
@import '@/config/base.less';

.article-page {
  position: relative;
}

.article-wrap {
  height: 100vh;
  background-image: url(/assets/image/article/read-bg.jpg);
  background-attachment: fixed;
  background-size: cover;
  overflow: auto;
}

.article-container {
  max-width: 1100px;
  min-height: 100vh;
  padding: 50px;
  margin: 0 auto;
  border-left: 10px solid rgba(255, 255, 255, 0.2);
  border-right: 10px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.9);
}

.title {
  text-align: center;
  letter-spacing: 0.05em;
  font-size: 28px;
  margin-bottom: 20px;
}

.tags {
  text-align: center;
  margin-bottom: 10px;
}

.time {
  text-align: right;
  color: #999;
  margin-bottom: 30px;
}

.article-content-s {
  margin-top: 20px;
}

.markdown-body {
  background-color: transparent !important;
  font-family: inherit;
}

.img-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: rgba(255, 255, 255, 0.95);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  
  .modal-image {
    max-width: 90%;
    max-height: 90%;
    box-shadow: 0 0 20px rgba(0,0,0,0.1);
    animation: showImage 0.3s cubic-bezier(0, -0.5, 0.2, 1.4);
  }
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.forbidden-scroll {
  overflow: hidden;
}

@keyframes showImage {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media only screen and (max-width: @threshold) {
  .article-container {
    padding: 30px 15px;
    border: none;
  }
}
</style>

<style lang="less">
.article-content-s {
  img {
    max-width: 100%;
    cursor: pointer;
    border-radius: 4px;
    transition: transform 0.3s;
    &:hover {
      transform: scale(1.01);
    }
  }
  code {
    font-size: 90% !important;
  }
}
</style>

