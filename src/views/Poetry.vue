<template>
  <main class="poetry-container garden-surface">
    <header class="garden-site-header">
      <router-link to="/" class="garden-brand" aria-label="回到静谧花园首页">
        <span class="garden-brand-seal" aria-hidden="true">静</span>
        <span class="garden-brand-text">
          <strong>静谧花园</strong>
          <small>Silence Garden</small>
        </span>
      </router-link>
      <nav class="garden-page-nav" aria-label="页面导航">
        <span class="garden-page-label">一方未完之地 / 01</span>
        <router-link to="/" class="garden-page-link">回到题记</router-link>
      </nav>
    </header>

    <div class="garden-page-main poetry-main">
      <section class="garden-hero poetry-hero">
        <div>
          <p class="garden-eyebrow">一 · 句读 / POETRY</p>
          <h1 class="garden-hero-title">诗草<br /><em>留在风里</em></h1>
          <p class="garden-hero-description">
            收拢一些不急于解释的句子。它们从旧纸上来，也在今天继续生长。
          </p>
          <div class="garden-index">
            <span>{{ catalog.length }} 首诗稿</span>
            <span>沿着题名入园</span>
          </div>
        </div>

        <div class="poetry-search-block">
          <span class="garden-stamp" aria-hidden="true">诗</span>
          <p>检索一枚题名、一位作者，或一句仍未忘记的话。</p>
          <a-input-search
            v-model:value="keyword"
            class="poetry-search"
            placeholder="题名 / 作者 / 诗句"
            enter-button="寻句"
            @search="indistinctSearch"
          />
        </div>
      </section>

      <section class="poetry-catalog" aria-labelledby="poetry-catalog-title">
        <div class="garden-list-heading">
          <h2 id="poetry-catalog-title">诗册目录</h2>
          <p>每一行，都是一扇可以慢慢推开的门</p>
        </div>

        <div v-if="catalog.length" class="poetry-list">
          <router-link
            v-for="(item, index) in catalog"
            :key="item.title || index"
            :to="'/poem/' + item.title"
            class="poetry-entry"
          >
            <span class="poetry-entry-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="poetry-entry-body">
              <span class="poetry-entry-meta">{{ item.tag && item.tag.length ? item.tag[0] : '诗稿' }}</span>
              <strong>{{ item.title }}</strong>
              <span class="poetry-entry-excerpt">{{ item.poetry || '一页尚未展开的诗稿' }}</span>
            </span>
            <span class="poetry-entry-arrow" aria-hidden="true">↗</span>
          </router-link>
        </div>
        <p v-else class="garden-empty">风还没有把诗页送到这里。</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { usePoetryStore } from '@/store/poetry'

const poetryStore = usePoetryStore()
const poetryScrollKey = 'silence-garden:poetry-scroll-top'

const catalog = computed(() => poetryStore.catalog)
const keyword = computed({
  get: () => poetryStore.keyword,
  set: (value: string) => poetryStore.setKeyword(value)
})

const indistinctSearch = async (): Promise<void> => {
  if (keyword.value) {
    await poetryStore.getPoetryCatalogByKeyword({ keyword: keyword.value })
  } else {
    await poetryStore.getPoetryCatalog()
  }
}

const restoreScrollPosition = async () => {
  await indistinctSearch()
  await nextTick()

  const savedPosition = Number(sessionStorage.getItem(poetryScrollKey))
  if (!Number.isFinite(savedPosition) || savedPosition <= 0) return

  requestAnimationFrame(() => {
    window.scrollTo({ top: savedPosition, left: 0, behavior: 'auto' })
  })
}

onMounted(restoreScrollPosition)

onBeforeUnmount(() => {
  sessionStorage.setItem(poetryScrollKey, String(window.scrollY))
})
</script>

<style lang="less" scoped>
@import '@/config/base.less';

.poetry-container {
  font-family: @poem;
}

.poetry-main {
  position: relative;
}

.poetry-main::after {
  position: absolute;
  top: 100px;
  right: -80px;
  width: 360px;
  height: 360px;
  border: 1px solid rgba(95, 128, 108, 0.16);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.poetry-search-block {
  position: relative;
  max-width: 380px;
  padding: 28px 0 0 28px;
  border-left: 1px solid rgba(49, 87, 70, 0.28);
}

.poetry-search-block::before {
  position: absolute;
  top: 0;
  left: -1px;
  width: 1px;
  height: 68px;
  content: '';
  background: #a94737;
}

.poetry-search-block p {
  max-width: 260px;
  margin: 22px 0 20px;
  color: #718078;
  font-size: 16px;
  line-height: 1.8;
}

.poetry-search {
  width: 100%;
  font-family: @poem;

  :deep(.ant-input-group) {
    display: flex;
  }

  :deep(.ant-input) {
    height: 44px;
    color: #1e2924;
    background: rgba(255, 255, 255, 0.28) !important;
    border-color: rgba(49, 87, 70, 0.26);
    border-right: 0;
    font-family: @poem;
    font-size: 16px;
    box-shadow: none;
  }

  :deep(.ant-input::placeholder) {
    color: #8b968e;
  }

  :deep(.ant-input-search-button) {
    height: 44px;
    color: #f7f2e6;
    background: #315746;
    border-color: #315746;
    font-family: @poem;
  }

  :deep(.ant-input-search-button:hover) {
    background: #a94737;
    border-color: #a94737;
  }
}

.poetry-catalog {
  position: relative;
}

.poetry-list {
  border-top: 1px solid rgba(49, 87, 70, 0.1);
}

.poetry-entry {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) 40px;
  gap: 22px;
  align-items: center;
  min-height: 116px;
  padding: 18px 12px;
  color: #1e2924;
  border-bottom: 1px solid rgba(49, 87, 70, 0.18);
  text-decoration: none;
  transition: background 0.3s ease, padding 0.3s ease, border-color 0.3s ease;
}

.poetry-entry:hover {
  padding-right: 24px;
  padding-left: 24px;
  background: rgba(255, 255, 255, 0.33);
  border-color: rgba(169, 71, 55, 0.42);
}

.poetry-entry:focus-visible {
  outline: 2px solid #a94737;
  outline-offset: -2px;
}

.poetry-entry-index {
  align-self: start;
  padding-top: 4px;
  color: #9aaba0;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
}

.poetry-entry-body {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.poetry-entry-meta {
  color: #a94737;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
}

.poetry-entry-body strong {
  overflow: hidden;
  font-size: 26px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poetry-entry-excerpt {
  overflow: hidden;
  color: #718078;
  font-size: 14px;
  line-height: 1.7;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poetry-entry-arrow {
  color: #5f806c;
  font-family: Georgia, serif;
  font-size: 28px;
  text-align: right;
  transition: color 0.3s ease, transform 0.3s ease;
}

.poetry-entry:hover .poetry-entry-arrow {
  color: #a94737;
  transform: translate(4px, -4px);
}

@media only screen and (max-width: @threshold) {
  .poetry-main::after {
    top: 320px;
    right: -240px;
  }

  .poetry-search-block {
    margin-top: 36px;
    padding-left: 20px;
  }

  .poetry-entry {
    grid-template-columns: 36px minmax(0, 1fr) 24px;
    gap: 10px;
    min-height: 98px;
    padding: 14px 4px;
  }

  .poetry-entry:hover {
    padding-right: 10px;
    padding-left: 10px;
  }

  .poetry-entry-body strong {
    font-size: 21px;
  }

  .poetry-entry-excerpt {
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .poetry-entry,
  .poetry-entry-arrow {
    transition: none;
  }
}
</style>
