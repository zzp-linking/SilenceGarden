<template>
  <main class="article-page garden-surface">
    <header class="garden-site-header">
      <router-link to="/" class="garden-brand" aria-label="回到静谧花园首页">
        <span class="garden-brand-seal" aria-hidden="true">静</span>
        <span class="garden-brand-text">
          <strong>静谧花园</strong>
          <small>Silence Garden</small>
        </span>
      </router-link>
      <nav class="garden-page-nav" aria-label="页面导航">
        <span class="garden-page-label">二 · 札记 / READING</span>
        <router-link to="/article" class="garden-page-link">返回文章目录</router-link>
      </nav>
    </header>

    <div class="article-wrap" :class="{ 'forbidden-scroll': modalImgOpen }">
      <div class="article-read-shell">
        <aside class="article-side-note">
          <span class="garden-stamp" aria-hidden="true">阅</span>
          <p class="garden-eyebrow">A NOTE IN PROGRESS</p>
          <p>阅读不是抵达答案，而是和一个念头多相处一会儿。</p>
          <router-link to="/article" class="garden-text-link">← 文章目录</router-link>
        </aside>

        <article class="article-container">
          <header class="article-header">
            <p class="article-kicker">静谧花园 · 札记</p>
            <h1 class="title">{{ article.title || '文章载入中' }}</h1>
            <div v-if="article.tags && article.tags.length" class="tags">
              <span v-for="item in article.tags" :key="item">{{ item }}</span>
            </div>
            <time v-if="article.time" class="time">{{ article.time }}</time>
          </header>

          <div
            class="article-content-s markdown-body"
            @click="contentClick"
            v-html="html"
          ></div>

          <footer class="article-footer">
            <span>此页读毕，仍可回到园中</span>
            <span class="article-footer-seal" aria-hidden="true">静</span>
          </footer>
        </article>
      </div>
    </div>

    <div v-if="modalImgOpen" class="img-modal open" role="dialog" aria-label="图片预览" @click="modalImgOpen = false">
      <img class="modal-image" :src="modalImg" alt="文章图片预览">
    </div>

    <button
      v-show="showBackToTop"
      class="back-to-top"
      type="button"
      aria-label="回到文章顶部"
      title="回到顶部"
      @click="scrollToTop"
    >
      <arrow-up-outlined aria-hidden="true" />
      <span>回顶</span>
    </button>

    <Loading :loading="loading" />
  </main>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useArticleStore } from '@/store/article'
import { isPc } from '@/utils/tool'
import Loading from '@/components/Loading.vue'
import { ArrowUpOutlined } from '@ant-design/icons-vue'
import 'github-markdown-css/github-markdown.css'
import 'highlight.js/styles/github.css'

const route = useRoute()
const articleStore = useArticleStore()

const modalImgOpen = ref(false)
const modalImg = ref('')
const showBackToTop = ref(false)

const article = computed(() => articleStore.article)
const html = computed(() => articleStore.article.html || '')
const loading = computed(() => articleStore.get_article_loading)

const handleScroll = () => {
  showBackToTop.value = window.scrollY > 420
}

const scrollToTop = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: reduceMotion ? 'auto' : 'smooth'
  })
}

onMounted(() => {
  const id = route.params.id
  if (id) {
    articleStore.getArticleDetails({ id })
  }

  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

const contentClick = (event) => {
  if (isPc() && event.target.nodeName === 'IMG') {
    modalImg.value = event.target.getAttribute('src')
    modalImgOpen.value = true
  }
}
</script>

<style scoped lang="less">
@import '@/config/base.less';

.article-page {
  font-family: @poem;
}

.article-wrap {
  min-height: calc(100vh - 90px);
}

.article-read-shell {
  display: grid;
  grid-template-columns: minmax(180px, 0.35fr) minmax(0, 1fr);
  gap: clamp(38px, 9vw, 150px);
  align-items: start;
  width: min(1280px, calc(100% - 72px));
  margin: 0 auto;
  padding: clamp(56px, 8vw, 110px) 0 120px;
}

.article-side-note {
  position: sticky;
  top: 36px;
  padding-top: 8px;
}

.article-side-note .garden-stamp {
  margin-bottom: 32px;
}

.article-side-note p:not(.garden-eyebrow) {
  max-width: 190px;
  margin: 0 0 28px;
  color: #718078;
  font-size: 16px;
  line-height: 2;
}

.article-container {
  min-height: 640px;
  padding: clamp(30px, 5vw, 78px) clamp(24px, 8vw, 110px) 42px;
  background: rgba(255, 255, 255, 0.38);
  border: 1px solid rgba(49, 87, 70, 0.2);
  box-shadow: 16px 18px 0 rgba(49, 87, 70, 0.06);
}

.article-header {
  padding-bottom: 38px;
  border-bottom: 1px solid rgba(49, 87, 70, 0.17);
}

.article-kicker {
  margin: 0 0 28px;
  color: #a94737;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
}

.title {
  max-width: 760px;
  margin: 0 0 28px;
  color: #1e2924;
  font-family: @poem;
  font-size: clamp(38px, 5vw, 66px);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.15;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.tags span {
  padding: 4px 10px;
  color: #5f806c;
  border: 1px solid rgba(95, 128, 108, 0.36);
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.time {
  display: block;
  color: #9aa79e;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.article-content-s {
  margin-top: 46px;
}

.article-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 78px;
  padding-top: 18px;
  color: #9aa79e;
  border-top: 1px solid rgba(49, 87, 70, 0.16);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
}

.article-footer-seal {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: #a94737;
  border: 1px solid rgba(169, 71, 55, 0.45);
  font-family: @poem;
  font-size: 15px;
}

.img-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(242, 238, 227, 0.96);
  cursor: zoom-out;
}

.modal-image {
  max-width: 90%;
  max-height: 90%;
  box-shadow: 0 20px 60px rgba(30, 41, 36, 0.18);
  animation: show-image 0.3s cubic-bezier(0, -0.5, 0.2, 1.4);
}

.forbidden-scroll {
  overflow: hidden;
}

.back-to-top {
  position: fixed;
  right: clamp(20px, 4vw, 48px);
  bottom: clamp(22px, 4vw, 40px);
  z-index: 100;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 48px;
  min-height: 58px;
  padding: 8px 6px;
  color: #315746;
  background: rgba(242, 238, 227, 0.86);
  border: 1px solid rgba(49, 87, 70, 0.32);
  border-radius: 2px;
  box-shadow: 4px 5px 0 rgba(49, 87, 70, 0.08);
  backdrop-filter: blur(6px);
  cursor: pointer;
  font-family: @poem;
  font-size: 12px;
  transition: color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
}

.back-to-top::before {
  position: absolute;
  top: -1px;
  left: 8px;
  width: 1px;
  height: 18px;
  content: '';
  background: #c6a15b;
}

.back-to-top:hover {
  color: #a94737;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 2px 3px 0 rgba(49, 87, 70, 0.12);
  transform: translateY(-3px);
}

.back-to-top:focus-visible {
  outline: 2px solid #a94737;
  outline-offset: 4px;
}

@keyframes show-image {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media only screen and (max-width: @threshold) {
  .article-read-shell {
    display: block;
    width: min(100% - 32px, 680px);
    padding-top: 48px;
  }

  .article-side-note {
    position: static;
    margin-bottom: 38px;
  }

  .article-side-note .garden-stamp {
    float: left;
    margin: 0 20px 10px 0;
  }

  .article-side-note p:not(.garden-eyebrow) {
    max-width: none;
    font-size: 14px;
  }

  .article-container {
    min-height: 480px;
    padding: 28px 22px 30px;
    box-shadow: 8px 10px 0 rgba(49, 87, 70, 0.06);
  }

  .article-content-s {
    margin-top: 34px;
  }

  .article-footer {
    margin-top: 56px;
  }

  .back-to-top {
    right: 16px;
    bottom: 18px;
    width: 44px;
    min-height: 52px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .back-to-top {
    transition: none;
  }
}
</style>

<style lang="less">
.article-content-s {
  .markdown-body {
    background-color: transparent;
  }
  .hljs {
    background-color: transparent;
  }
  // color: #304239;
  // font-family: "信笺手写体", "STKaiti", "KaiTi", serif;
  // font-size: 18px;
  // line-height: 2;

  // h1,
  // h2,
  // h3,
  // h4 {
  //   color: #1e2924;
  //   font-family: "信笺手写体", "STKaiti", "KaiTi", serif;
  //   font-weight: 400;
  //   line-height: 1.45;
  // }

  // h2 {
  //   margin-top: 2.2em;
  //   padding-left: 16px;
  //   border-left: 2px solid #a94737;
  // }

  // a {
  //   color: #315746;
  // }

  // blockquote {
  //   margin: 28px 0;
  //   padding: 8px 24px;
  //   color: #718078;
  //   border-left: 1px solid #c6a15b;
  //   background: rgba(169, 192, 168, 0.12);
  // }

  // pre {
  //   border: 1px solid rgba(49, 87, 70, 0.14);
  //   background: rgba(230, 225, 211, 0.62) !important;
  // }

  // img {
  //   max-width: 100%;
  //   cursor: pointer;
  //   border: 1px solid rgba(49, 87, 70, 0.14);
  //   transition: transform 0.3s ease, box-shadow 0.3s ease;
  // }

  // img:hover {
  //   box-shadow: 0 10px 24px rgba(49, 87, 70, 0.12);
  //   transform: translateY(-2px);
  // }

  // code {
  //   font-size: 90% !important;
  // }
}

@media only screen and (max-width: 768px) {
  .article-content-s {
    font-size: 16px;
    line-height: 1.9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-image,
  .article-content-s img {
    animation: none;
    transition: none;
  }
}
</style>
