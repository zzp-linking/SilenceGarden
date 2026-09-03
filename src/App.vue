<template>
  <a-config-provider :locale="zhCN">
    <div id="app-content">
      <router-view />
      <Loading :loading="globalStore.loading" />
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import Loading from '@/components/Loading.vue';
import { useGlobalStore } from '@/store/global';

const globalStore = useGlobalStore();
</script>

<style>
#app, #app-content {
  height: 100%;
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

