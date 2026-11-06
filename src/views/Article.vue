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
        <router-link :to="returnPath" class="garden-page-link">{{ article.collection ? '返回合集目录' : '返回文章目录' }}</router-link>
      </nav>
    </header>

    <div class="article-wrap" :class="{ 'forbidden-scroll': modalImgOpen }">
      <div class="article-read-shell">
        <aside class="article-side-note">
          <span class="garden-stamp" aria-hidden="true">阅</span>
          <p class="garden-eyebrow">A NOTE IN PROGRESS</p>
          <p>阅读不是抵达答案，而是和一个念头多相处一会儿。</p>
          <router-link :to="returnPath" class="garden-text-link">← {{ article.collection?.title || '文章目录' }}</router-link>
          <router-link v-if="user.user?.role === 'admin'" :to="'/editor/' + route.params.id" class="garden-text-link">编辑文章</router-link>
        </aside>

        <article class="article-container">
          <header class="article-header">
            <p v-if="readError" role="alert">{{ readError }} <button type="button" @click="reload++">重新加载</button></p>
            <p v-if="article.collectionSync === 'pending'" role="status">合集目录正在同步，正文可以继续阅读。<button type="button" @click="reload++">重试导航</button></p>
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
          <nav v-if="article.collection" class="article-chapters" aria-label="合集阅读顺序">
            <RouterLink v-if="article.collection.previous" :to="'/article/' + article.collection.previous._id">上一篇 · {{ article.collection.previous.title }}</RouterLink>
            <RouterLink :to="returnPath">合集目录</RouterLink>
            <RouterLink v-if="article.collection.next" :to="'/article/' + article.collection.next._id">下一篇 · {{ article.collection.next.title }}</RouterLink>
          </nav>
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

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch, shallowRef } from 'vue'
import DOMPurify from 'dompurify'
import { useRoute } from 'vue-router'
import { useArticleStore } from '@/stores/article'
import { useUserStore } from '@/stores/user'
import { isPc } from '@/utils/tool'
import Loading from '@/components/Loading.vue'
import { ArrowUpOutlined } from '@ant-design/icons-vue'
import 'github-markdown-css/github-markdown.css'
import 'highlight.js/styles/github.css'
import type { IdParams } from '@/types/api'

const route = useRoute()
const articleStore = useArticleStore()
const user = useUserStore()
const readError = shallowRef('')
const reload = shallowRef(0)

const modalImgOpen = ref(false)
const modalImg = ref('')
const showBackToTop = ref(false)

const article = computed(() => articleStore.article)
const returnPath = computed(() => article.value.collection ? '/article/collection/' + article.value.collection._id : '/article')
const html = computed(() => DOMPurify.sanitize(articleStore.article.html || '', {
  USE_PROFILES: { html: true }
}))
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

watch(() => [route.params.id, reload.value], async (_value, _old, cleanup) => {
  const controller = new AbortController()
  cleanup(() => controller.abort())
  readError.value = ''
  const idParam = route.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  if (id) {
    const params: IdParams = { id }
    try { await articleStore.getArticleDetails(params, controller.signal) }
    catch (cause) { if (!controller.signal.aborted) readError.value = cause instanceof Error ? cause.message : '文章加载失败' }
  }
}, { immediate: true })

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

const contentClick = (event: MouseEvent): void => {
  const target = event.target
  if (isPc() && target instanceof HTMLImageElement) {
    modalImg.value = target.getAttribute('src') || ''
    modalImgOpen.value = true
  }
}
</script>

<style scoped lang="less">
@import '@/config/base.less';

.article-page {
  font-family: @poem;
}
.article-chapters { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-top: 24px; }
.article-chapters a { color: #315746; min-height: 44px; display: flex; align-items: center; overflow-wrap: anywhere; }

.article-wrap {
  min-height: calc(100vh - 90px);
}

.article-read-shell {
  display: grid;
  // 两侧使用等宽外列，使阅读区域不受旁注宽度影响而保持居中。
  grid-template-columns: minmax(0, 1fr) minmax(0, 860px) minmax(0, 1fr);
  gap: 32px;
  align-items: start;
  width: min(1480px, calc(100% - 72px));
  margin: 0 auto;
  padding: clamp(56px, 8vw, 90px) 0 120px;
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
  grid-column: 2;
  min-width: 0;
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

@media only screen and (max-width: 1360px) {
  .article-read-shell {
    display: block;
    width: min(860px, calc(100% - 72px));
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
  }
}

@media only screen and (max-width: @threshold) {
  .article-read-shell {
    width: min(680px, calc(100% - 32px));
    padding-top: 48px;
  }

  .article-side-note p:not(.garden-eyebrow) {
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
  &.markdown-body {
    background-color: transparent;
  }
  .hljs {
    background-color: transparent;
  }
  // 历史样式参考：color: #304239;
  // font-family: "信笺手写体", "STKaiti", "KaiTi", serif;
  // 历史样式参考：font-size: 18px;
  // 历史样式参考：line-height: 2;

  // 历史样式参考：h1,
  // 历史样式参考：h2,
  // 历史样式参考：h3,
  // 历史样式参考：h4 {
  // 历史样式参考：color: #1e2924;
  //   font-family: "信笺手写体", "STKaiti", "KaiTi", serif;
  // 历史样式参考：font-weight: 400;
  // 历史样式参考：line-height: 1.45;
  // }

  // 历史样式参考：h2 {
  // 历史样式参考：margin-top: 2.2em;
  // 历史样式参考：padding-left: 16px;
  // 历史样式参考：border-left: 2px solid #a94737;
  // }

  // 历史样式参考：a {
  // 历史样式参考：color: #315746;
  // }

  // 历史样式参考：blockquote {
  // 历史样式参考：margin: 28px 0;
  // 历史样式参考：padding: 8px 24px;
  // 历史样式参考：color: #718078;
  // 历史样式参考：border-left: 1px solid #c6a15b;
  // 历史样式参考：background: rgba(169, 192, 168, 0.12);
  // }

  // 历史样式参考：pre {
  // 历史样式参考：border: 1px solid rgba(49, 87, 70, 0.14);
  // 历史样式参考：background: rgba(230, 225, 211, 0.62) !important;
  // }

  // 历史样式参考：img {
  // 历史样式参考：max-width: 100%;
  // 历史样式参考：cursor: pointer;
  // 历史样式参考：border: 1px solid rgba(49, 87, 70, 0.14);
  // 历史样式参考：transition: transform 0.3s ease, box-shadow 0.3s ease;
  // }

  // 历史样式参考：img:hover {
  // 历史样式参考：box-shadow: 0 10px 24px rgba(49, 87, 70, 0.12);
  // 历史样式参考：transform: translateY(-2px);
  // }

  // 历史样式参考：code {
  // 历史样式参考：font-size: 90% !important;
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
