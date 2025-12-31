<template>
  <div class="violin-catalog-container">
    <div class="content">
      <a-row :gutter="[16, 16]" type="flex" justify="space-around" class="link-group">
        <a-col
          v-for="(item, index) in catalog"
          :key="index"
          :lg="6"
          :md="10"
          :sm="11"
          :xs="22"
          class="animate__animated animate__fadeInUp link-item"
          :style="{ animationDelay: index * 0.1 + 's' }"
        >
          <LinkBox :violin="item" />
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useViolinStore } from '@/store/violin'
import LinkBox from '@/components/LinkBox.vue'

const violinStore = useViolinStore()
const catalog = computed(() => violinStore.catalog)

onMounted(() => {
  violinStore.getVillinCatalog()
})
</script>

<style scoped lang="less">
@import '@/config/base.less';

.violin-catalog-container {
  min-height: 100vh;
  background-color: #1a1a1a; // 添加一个深色底色，在图片加载出来前保证文字清晰
  background-image: url(/assets/image/violin/violin-catalog-bg.jpg);
  background-position: center;
  background-attachment: fixed;
  background-size: cover;
  overflow: hidden;
  padding: 100px 20px 40px;
}

.content {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.link-group {
  margin-top: 60px;
}

.link-item {
  margin-bottom: 20px;
}

@media only screen and (max-width: @threshold) {
  .violin-catalog-container {
    padding-top: 40px;
  }
  .link-group {
    margin-top: 20px;
  }
}
</style>

