<template>
  <div class="article-catalog">
    <div class="container">
      <div v-for="(item, index) in catalog" :key="item._id" class="catalog-item">
        <router-link class="link" :to="'/article/' + item._id">
          {{ index + 1 + '、' }}{{ item.title }}
        </router-link>
        <a-tag v-for="(el, tagIndex) in item.tags" :key="tagIndex" color="success" class="tag">
          {{ el }}
        </a-tag>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useArticleStore } from '@/store/article'

const articleStore = useArticleStore()
const catalog = computed(() => articleStore.catalog)

onMounted(() => {
  articleStore.getArticleCatalog()
})
</script>

<style scoped lang="less">
@import "@/config/base.less";

.article-catalog {
  min-height: 100vh;
  background-image: url(/assets/image/article/read-bg.jpg);
  background-attachment: fixed;
  background-size: cover;
}

.container {
  max-width: 1100px;
  min-height: 100vh;
  padding: 50px;
  margin: 0 auto;
  border-left: 10px solid rgba(255, 255, 255, 0.2);
  border-right: 10px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.8);
}

.catalog-item {
  font-size: 16px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.link {
  color: #333;
  margin-right: 10px;
  text-decoration: none;
  font-size: 18px;
  transition: color 0.3s;

  &:hover {
    color: @secondary;
  }
}

.tag {
  margin: 2px;
}

@media only screen and (max-width: @threshold) {
  .container {
    padding: 30px 15px;
    border: none;
  }
}
</style>

