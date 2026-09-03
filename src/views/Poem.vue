<template>
  <main class="poem-page garden-surface">
    <header class="garden-site-header">
      <router-link to="/" class="garden-brand" aria-label="回到静谧花园首页">
        <span class="garden-brand-seal" aria-hidden="true">静</span>
        <span class="garden-brand-text">
          <strong>静谧花园</strong>
          <small>Silence Garden</small>
        </span>
      </router-link>
      <nav class="garden-page-nav" aria-label="页面导航">
        <span class="garden-page-label">一 · 句读 / POEM</span>
        <router-link to="/poetry" class="garden-page-link">返回诗册</router-link>
      </nav>
    </header>

    <div class="poem-layout garden-page-main">
      <aside class="poem-side-note">
        <span class="garden-stamp" aria-hidden="true">读</span>
        <p class="garden-eyebrow">A PAGE TO KEEP</p>
        <p class="poem-side-copy">句子不必急着抵达。让它在纸上多停一会儿。</p>
        <div v-if="poem.author" class="poem-author">{{ poem.author }}</div>
        <div v-if="poem.tag && poem.tag.length" class="poem-tags">
          <span v-for="tag in poem.tag" :key="tag">{{ tag }}</span>
        </div>
      </aside>

      <article class="poem-sheet">
        <header class="poem-sheet-header">
          <span class="poem-sheet-label">诗稿 / {{ poem.section ? '分章' : '单页' }}</span>
          <span class="poem-sheet-mark" aria-hidden="true">○</span>
        </header>

        <h1 class="poem-title">{{ poem.title || '诗稿载入中' }}</h1>

        <div v-if="content && content.length" class="poem-content">
          <template v-if="section">
            <section v-for="(list, index) in content" :key="index" class="poem-section">
              <span
                v-for="(item, itemIndex) in list"
                :key="itemIndex"
                class="poem-sentence"
                :class="poem.type === 'poem' ? 'is-poem' : 'is-essay'"
              >
                {{ item }}
              </span>
            </section>
          </template>
          <section v-else class="poem-section">
            <span
              v-for="(item, index) in content"
              :key="index"
              class="poem-sentence"
              :class="poem.type === 'poem' ? 'is-poem' : 'is-essay'"
            >
              {{ item }}
            </span>
          </section>
        </div>
        <p v-else class="garden-empty">这页诗稿还在路上。</p>

        <footer class="poem-sheet-footer">
          <span>静谧花园 · 句读</span>
          <span aria-hidden="true">✦</span>
        </footer>
      </article>
    </div>
    <button
      v-show="showBackToTop"
      class="back-to-top"
      type="button"
      aria-label="回到诗词顶部"
      title="回到顶部"
      @click="scrollToTop"
    >
      <arrow-up-outlined aria-hidden="true" />
      <span>回顶</span>
    </button>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePoetryStore } from '@/store/poetry'
import { ArrowUpOutlined } from '@ant-design/icons-vue'

const route = useRoute()
const poetryStore = usePoetryStore()

const poem = computed(() => poetryStore.poem)
const section = computed(() => poetryStore.poem.section)
const content = computed(() => poetryStore.poem.content)
const showBackToTop = ref(false)

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
  const title = route.params.title
  if (title) {
    poetryStore.getPoemByTitle({ title })
  }

  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped lang="less">
@import '@/config/base.less';

.poem-page {
  font-family: @poem;
}

.poem-layout {
  display: grid;
  grid-template-columns: minmax(180px, 0.35fr) minmax(0, 1fr);
  gap: clamp(38px, 9vw, 150px);
  align-items: start;
  padding-top: clamp(52px, 8vw, 110px);
}

.poem-side-note {
  position: sticky;
  top: 36px;
  padding-top: 8px;
}

.poem-side-note .garden-stamp {
  margin-bottom: 32px;
}

.poem-side-note .garden-eyebrow {
  margin-bottom: 16px;
}

.poem-side-copy {
  max-width: 180px;
  margin: 0;
  color: #718078;
  font-size: 16px;
  line-height: 2;
}

.poem-author {
  margin-top: 38px;
  color: #315746;
  font-size: 17px;
}

.poem-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.poem-tags span {
  padding: 4px 9px;
  color: #718078;
  border-bottom: 1px solid rgba(49, 87, 70, 0.26);
  font-size: 12px;
}

.poem-sheet {
  position: relative;
  min-height: 580px;
  padding: clamp(28px, 5vw, 70px) clamp(24px, 8vw, 110px) 38px;
  background: rgba(255, 255, 255, 0.38);
  border: 1px solid rgba(49, 87, 70, 0.2);
  box-shadow: 16px 18px 0 rgba(49, 87, 70, 0.06);
}

.poem-sheet::before,
.poem-sheet::after {
  position: absolute;
  width: 42px;
  height: 42px;
  content: '';
  pointer-events: none;
}

.poem-sheet::before {
  top: 13px;
  left: 13px;
  border-top: 1px solid #c6a15b;
  border-left: 1px solid #c6a15b;
}

.poem-sheet::after {
  right: 13px;
  bottom: 13px;
  border-right: 1px solid #c6a15b;
  border-bottom: 1px solid #c6a15b;
}

.poem-sheet-header,
.poem-sheet-footer {
  display: flex;
  justify-content: space-between;
  color: #9aa79e;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
}

.poem-sheet-mark {
  color: #a94737;
  font-size: 18px;
}

.poem-title {
  margin: 58px 0 72px;
  color: #1e2924;
  font-family: @poem;
  font-size: clamp(38px, 5vw, 68px);
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1.1;
  text-align: center;
}

.poem-content {
  color: #304239;
  font-size: clamp(20px, 2.1vw, 29px);
  line-height: 2.15;
}

.poem-section {
  margin-bottom: 2.4em;
}

.poem-sentence {
  display: block;
}

.poem-sentence.is-poem {
  text-align: center;
}

.poem-sentence.is-essay {
  text-indent: 2em;
}

.poem-sheet-footer {
  margin-top: 90px;
  padding-top: 18px;
  border-top: 1px solid rgba(49, 87, 70, 0.16);
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

@media only screen and (max-width: @threshold) {
  .poem-layout {
    display: block;
    padding-top: 48px;
  }

  .poem-side-note {
    position: static;
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 20px;
    align-items: center;
    margin-bottom: 38px;
  }

  .poem-side-note .garden-stamp {
    grid-row: span 2;
    margin: 0;
  }

  .poem-side-note .garden-eyebrow {
    margin: 0 0 8px;
  }

  .poem-side-copy {
    max-width: none;
    font-size: 14px;
  }

  .poem-author,
  .poem-tags {
    grid-column: 2;
    margin-top: 12px;
  }

  .poem-sheet {
    min-height: 480px;
    padding: 28px 22px 30px;
    box-shadow: 8px 10px 0 rgba(49, 87, 70, 0.06);
  }

  .poem-title {
    margin: 44px 0 52px;
    font-size: 38px;
  }

  .poem-content {
    font-size: 20px;
  }

  .poem-sheet-footer {
    margin-top: 60px;
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
