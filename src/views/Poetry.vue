<template>
  <div class="poetry-container">
    <div class="content">
      <div class="search-area">
        <a-input-search
          v-model:value="keyword"
          placeholder="根据标题、作者、诗集、标签、内容检索……"
          enter-button="搜索"
          size="large"
          @search="indistinctSearch"
          class="poetry-search"
        />
      </div>

      <a-row :gutter="[16, 16]" class="poetry-list">
        <a-col
          v-for="(item, index) in catalog"
          :key="index"
          :xs="12"
          :sm="8"
          :lg="6"
          class="animate__animated animate__bounceIn"
          :style="{ animationDelay: index * (isPc() ? 0.01 : 0.02) + 's' }"
        >
          <router-link :to="'/poem/' + item.title" class="item">
            {{ item.title }}
          </router-link>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { usePoetryStore } from '@/store/poetry'
import { isPc } from '@/utils/tool'

const poetryStore = usePoetryStore()

const catalog = computed(() => poetryStore.catalog)
const keyword = computed({
  get: () => poetryStore.keyword,
  set: (val) => poetryStore.setKeyword(val)
})

const indistinctSearch = () => {
  if (keyword.value) {
    poetryStore.getPoetryCatalogByKeyword({ keyword: keyword.value })
  } else {
    poetryStore.getPoetryCatalog()
  }
}

onMounted(() => {
  indistinctSearch()
})
</script>

<style lang="less" scoped>
@import '@/config/base.less';

.poetry-container {
  min-height: 100vh;
  background-image: url(/assets/image/common/poetry-list-bg.jpg);
  background-repeat: no-repeat;
  background-size: cover;
  background-attachment: fixed;
  font-family: @poem;
  padding: 50px 20px;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}

.search-area {
  margin-bottom: 50px;
  display: flex;
  justify-content: center;
}

.poetry-search {
  max-width: 800px;
  :deep(.ant-input-group-addon span) {
    font-family: @poem;
  }
  :deep(.ant-input) {
    background: rgba(255, 255, 255, 0.4) !important;
    border: none;
    font-size: 24px;
    height: 60px;
    color: firebrick;
    font-family: @poem;
    
    &::placeholder {
      color: #999;
      font-size: 18px;
    }
  }
  
  :deep(.ant-input-search-button) {
    height: 60px;
    width: 100px;
    font-size: 24px;
    background: rgba(0, 0, 0, 0.3) !important;
    border: none;
    color: #fff;
    
    &:hover {
      background: rgba(0, 0, 0, 0.5) !important;
    }
  }
}

.item {
  color: #383838;
  display: block;
  border-radius: 4px;
  padding: 10px;
  font-size: 28px;
  font-family: @poem;
  text-align: center;
  transition: all 0.5s;
  background: linear-gradient(-90deg, rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.8));
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: #2b85e4;
    transform: scale(1.05);
    background: linear-gradient(-90deg, rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.4));
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }
}

@media only screen and (max-width: @threshold) {
  .poetry-container {
    padding: 20px 10px;
  }
  .search-area {
    margin-bottom: 20px;
  }
  .item {
    font-size: 18px;
  }
}
</style>

