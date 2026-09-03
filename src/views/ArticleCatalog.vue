<template>
  <main class="article-catalog garden-surface">
    <header class="garden-site-header">
      <router-link to="/" class="garden-brand" aria-label="回到静谧花园首页">
        <span class="garden-brand-seal" aria-hidden="true">静</span>
        <span class="garden-brand-text">
          <strong>静谧花园</strong>
          <small>Silence Garden</small>
        </span>
      </router-link>
      <nav class="garden-page-nav" aria-label="页面导航">
        <span class="garden-page-label">二 · 札记 / NOTES</span>
        <router-link to="/" class="garden-page-link">回到题记</router-link>
      </nav>
    </header>

    <div class="garden-page-main article-main">
      <section class="garden-hero article-hero">
        <div>
          <p class="garden-eyebrow">二 · 札记 / NOTES</p>
          <h1 class="garden-hero-title">把想法写成<br /><em>可以回看的路</em></h1>
          <p class="garden-hero-description">
            一些关于代码、生活和正在发生之事的记录。不是结论，只是留下脚印。
          </p>
          <div class="garden-index">
            <span>{{ catalog.length }} 篇札记</span>
            <span>按时间展开</span>
          </div>
        </div>

        <div class="article-hero-note">
          <span class="garden-stamp" aria-hidden="true">记</span>
          <p>每一篇文章，都是一次暂时停下来的凝视。</p>
          <span class="article-hero-line" aria-hidden="true"></span>
        </div>
      </section>

      <section class="article-catalog-list" aria-labelledby="article-list-title">
        <div class="garden-list-heading">
          <h2 id="article-list-title">文章目录</h2>
          <p>从最近的一页开始，也可以任意走入</p>
        </div>

        <div v-if="catalog.length" class="article-list">
          <router-link
            v-for="(item, index) in catalog"
            :key="item._id || index"
            :to="'/article/' + item._id"
            class="article-entry"
          >
            <span class="article-entry-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="article-entry-main">
              <strong>{{ item.title }}</strong>
              <span class="article-entry-tags">
                <span v-for="tag in item.tags || []" :key="tag">{{ tag }}</span>
              </span>
            </span>
            <span class="article-entry-arrow" aria-hidden="true">↗</span>
          </router-link>
        </div>
        <p v-else class="garden-empty">墨色尚未干透，文章很快会回来。</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useArticleStore } from '@/store/article'

const articleStore = useArticleStore()
const catalog = computed(() => articleStore.catalog)

onMounted(() => {
  articleStore.getArticleCatalog()
})
</script>

<style scoped lang="less">
@import '@/config/base.less';

.article-catalog {
  font-family: @poem;
}

.article-main {
  position: relative;
}

.article-main::before {
  position: absolute;
  top: 80px;
  left: -12vw;
  width: 44vw;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent, rgba(169, 71, 55, 0.3), transparent);
  transform: rotate(-8deg);
}

.article-hero-note {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 280px;
  padding-top: 10px;
}

.article-hero-note p {
  margin: 26px 0;
  color: #718078;
  font-size: 18px;
  line-height: 2;
}

.article-hero-line {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, #c6a15b, transparent);
}

.article-list {
  border-top: 1px solid rgba(49, 87, 70, 0.1);
}

.article-entry {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) 40px;
  gap: 22px;
  align-items: center;
  min-height: 105px;
  padding: 18px 12px;
  color: #1e2924;
  border-bottom: 1px solid rgba(49, 87, 70, 0.18);
  text-decoration: none;
  transition: background 0.3s ease, padding 0.3s ease, border-color 0.3s ease;
}

.article-entry:hover {
  padding-right: 24px;
  padding-left: 24px;
  background: rgba(255, 255, 255, 0.33);
  border-color: rgba(169, 71, 55, 0.42);
}

.article-entry:focus-visible {
  outline: 2px solid #a94737;
  outline-offset: -2px;
}

.article-entry-index {
  align-self: start;
  padding-top: 4px;
  color: #9aaba0;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
}

.article-entry-main {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.article-entry-main strong {
  overflow: hidden;
  font-size: 25px;
  font-weight: 400;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.article-entry-tags span {
  padding: 3px 9px;
  color: #5f806c;
  border: 1px solid rgba(95, 128, 108, 0.34);
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.article-entry-arrow {
  color: #5f806c;
  font-family: Georgia, serif;
  font-size: 28px;
  text-align: right;
  transition: color 0.3s ease, transform 0.3s ease;
}

.article-entry:hover .article-entry-arrow {
  color: #a94737;
  transform: translate(4px, -4px);
}

@media only screen and (max-width: @threshold) {
  .article-hero-note {
    margin-top: 34px;
  }

  .article-entry {
    grid-template-columns: 36px minmax(0, 1fr) 24px;
    gap: 10px;
    min-height: 94px;
    padding: 14px 4px;
  }

  .article-entry:hover {
    padding-right: 10px;
    padding-left: 10px;
  }

  .article-entry-main strong {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-entry,
  .article-entry-arrow {
    transition: none;
  }
}
</style>
