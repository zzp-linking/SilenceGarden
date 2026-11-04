<script setup lang="ts">
import type { ArticleCatalogItem } from '@/types/article'
defineProps<{ items: ArticleCatalogItem[] }>()
</script>

<template>
  <div class="article-list">
    <RouterLink v-for="(item, index) in items" :key="item._id"
      :to="item.type === 'collection' ? '/article/collection/' + item._id : '/article/' + item._id"
      class="article-entry">
      <span class="article-entry-index">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="article-entry-main">
        <strong>{{ item.title }}</strong>
        <span v-if="item.type === 'collection'" class="article-entry-meta">
          <span class="collection-label">合集</span><span>{{ item.articleCount || 0 }} 篇文章</span>
          <span v-if="item.description" class="collection-description">{{ item.description }}</span>
        </span>
        <span v-else class="article-entry-tags"><span v-for="tag in item.tags || []" :key="tag">{{ tag }}</span></span>
      </span>
      <span class="article-entry-arrow" aria-hidden="true">↗</span>
    </RouterLink>
  </div>
</template>

<style scoped lang="less">
@import '@/config/base.less';
.article-list { border-top: 1px solid rgba(49,87,70,.18); }
.article-entry { display:grid; grid-template-columns:70px minmax(0,1fr) 32px; gap:22px; align-items:center; min-height:105px; padding:18px 12px; color:#1e2924; border-bottom:1px solid rgba(49,87,70,.18); text-decoration:none; transition:background .2s ease; }
.article-entry:hover { background:rgba(255,255,255,.4); }
.article-entry:focus-visible { outline:2px solid #a94737; outline-offset:-2px; }
.article-entry-index { color:#5a6b60; align-self:start; font:12px ui-monospace,monospace; padding-top:6px; }
.article-entry-main { min-width:0; display:grid; gap:12px; }
.article-entry-main strong { font-size:25px; font-weight:400; letter-spacing:.06em; overflow-wrap:anywhere; }
.article-entry-tags,.article-entry-meta { display:flex; flex-wrap:wrap; gap:8px; color:#466650; font:12px system-ui,sans-serif; }
.article-entry-tags span,.collection-label { border:1px solid rgba(95,128,108,.4); border-radius:16px; padding:3px 9px; }
.collection-label { color:#a94737; border-color:rgba(169,71,55,.4); }
.article-entry-meta { align-items:center; }
.collection-description { width:100%; color:#5a6b60; line-height:1.7; }
.article-entry-arrow { font:28px Georgia,serif; color:#5f806c; }
@media(max-width:760px) { .article-entry { grid-template-columns:30px minmax(0,1fr) 24px; gap:10px; padding:16px 4px; } .article-entry-main strong { font-size:20px; } }
@media(prefers-reduced-motion:reduce) { .article-entry { transition:none; } }
</style>
