<template>
  <a-config-provider :locale="zhCN">
    <div id="app-content" :class="{ 'is-fullscreen': isFullscreen }">
      <router-view />
      <Loading :loading="globalStore.loading" />
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import Loading from '@/components/Loading.vue';
import { useGlobalStore } from '@/stores/global';
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const globalStore = useGlobalStore();
const route = useRoute()
// AI 和管理后台自带完整壳层，其余页面继续使用站点默认导航布局。
const isFullscreen = computed(() => route.meta.layout === 'fullscreen')
</script>

<style>
#app, #app-content {
  height: 100%;
}

#app-content.is-fullscreen {
  overflow: hidden;
}

.clearfix:after {
  content: '';
  display: block;
  clear: both;
}

.overflow-ellipsis {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>

