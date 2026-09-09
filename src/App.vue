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
import { useGlobalStore } from '@/store/global';
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const globalStore = useGlobalStore();
const route = useRoute()
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

