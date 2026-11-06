<script setup lang="ts">
/** 受控游标导航不虚构总数，加载或写入期间禁止翻页。 */
defineProps<{
  /** previous：是否存在可返回的本地上一页游标。 */
  previous: boolean;
  /** next：服务端是否返回下一页游标。 */
  next: boolean;
  /** busy：当前请求进行中，禁止重复提交或不安全的页面切换。 */
  busy: boolean;
  /** page：本地游标历史中的零起始页号，仅用于展示，不作为数据库 offset。 */
  page: number
}>()
defineEmits<{
  /** previous：请求切换到已访问的上一页。 */
  previous: [];
  /** next：请求使用服务端下一页游标读取。 */
  next: []
}>()
</script>
<template>
  <a-space class="knowledge-pager" wrap><span class="admin-muted">第 {{ page + 1 }} 页</span><a-button :disabled="!previous || busy" @click="$emit('previous')">上一页</a-button><a-button :disabled="!next || busy" @click="$emit('next')">下一页</a-button></a-space>
</template>
<style scoped>.knowledge-pager { margin-top: 16px; display: flex; justify-content: flex-end; }</style>
