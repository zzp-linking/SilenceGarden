<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collectionsApi } from '@/api/articleCollections'
import { useUserStore } from '@/stores/user'
import type { ArticleCollection } from '@/types/article'
import ArticleCatalogList from '@/components/article/ArticleCatalogList.vue'
const route = useRoute()
const user = useUserStore()
const book = ref<ArticleCollection | null>(null)
const loading = shallowRef(false)
const error = shallowRef('')
const reload = shallowRef(0)
watch(() => [route.params.id, reload.value], async (_value, _old, cleanup) => {
  const controller = new AbortController(); cleanup(() => controller.abort())
  const raw = route.params.id; const id = Array.isArray(raw) ? raw[0] : raw
  loading.value = true; error.value = ''; book.value = null
  try { if (id) { const value = await collectionsApi.detail(id, false, controller.signal); if (!controller.signal.aborted) book.value = value } }
  catch (cause) { if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '合集加载失败' }
  finally { if (!controller.signal.aborted) loading.value = false }
}, { immediate: true })
</script>
<template>
  <main class="garden-surface collection-page">
    <header class="garden-site-header">
      <RouterLink to="/" class="garden-brand"><span class="garden-brand-seal" aria-hidden="true">静</span><span class="garden-brand-text"><strong>静谧花园</strong><small>Silence Garden</small></span></RouterLink>
      <nav class="garden-page-nav" aria-label="合集导航"><RouterLink to="/article" class="garden-page-link">返回文章目录</RouterLink></nav>
    </header>
    <div class="garden-page-main">
      <p class="garden-eyebrow">札记 · 合集</p>
      <p v-if="loading" role="status">正在翻开目录…</p>
      <div v-else-if="error" class="collection-error" role="alert"><p>{{ error }}</p><button type="button" @click="reload++">重新加载</button></div>
      <template v-else-if="book">
        <h1 class="garden-hero-title collection-title">{{ book.title }}</h1>
        <p class="garden-hero-description">{{ book.description }}</p>
        <div class="garden-index"><span>{{ book.articleCount }} 篇文章</span><span>按阅读顺序展开</span></div>
        <nav v-if="user.user?.role === 'admin'" class="collection-admin" aria-label="合集管理操作">
          <RouterLink :to="{ path: '/editor', query: { collectionId: book._id } }">在此合集写文章</RouterLink>
          <RouterLink :to="{ path: '/admin/article-collections', query: { id: book._id } }">管理合集</RouterLink>
        </nav>
        <ArticleCatalogList v-if="book.items.length" :items="book.items" />
        <p v-else class="garden-empty">合集尚未收录文章。</p>
      </template>
    </div>
  </main>
</template>
<style scoped lang="less">
@import '@/config/base.less';
.collection-page { font-family:@poem; }
.collection-page .garden-hero-description { color:#5a6b60; }
.collection-title { margin:24px 0; overflow-wrap:anywhere; }
.collection-admin { display:flex; flex-wrap:wrap; gap:20px; margin:24px 0; }
.collection-admin a { color:#315746; text-underline-offset:5px; min-height:44px; display:flex; align-items:center; }
.collection-error { color:#9f3030; }
.collection-error button { min-height:44px; padding:8px 16px; border:1px solid #aabfaf; background:#fff; cursor:pointer; }
</style>
