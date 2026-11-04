<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons-vue'
import type { ArticleCatalogItem } from '@/types/article'
const props = defineProps<{ items: ArticleCatalogItem[]; disabled?: boolean }>()
const emit = defineEmits<{ save: [ids: string[]]; remove: [id: string]; move: [id: string]; dirty: [value: boolean] }>()
const ordered = ref<ArticleCatalogItem[]>([])
const dragging = shallowRef(-1)
watch(() => props.items, value => { ordered.value = [...value] }, { immediate: true })
const changed = computed(() => ordered.value.some((item, index) => item._id !== props.items[index]?._id))
watch(changed, value => emit('dirty', value), { immediate: true })
const columns = [{ title: '顺序', key: 'index', width: 70 }, { title: '文章', dataIndex: 'title', key: 'title', width: 220 }, { title: '操作', key: 'actions', width: 400 }]
function move(from: number, to: number) {
  if (props.disabled || to < 0 || to >= ordered.value.length || from === to) return
  const result = [...ordered.value]; const item = result.splice(from, 1)[0]
  if (item) result.splice(to, 0, item)
  ordered.value = result
}
function customRow(_item: ArticleCatalogItem, index?: number) {
  return {
    draggable: !props.disabled,
    onDragstart(event: DragEvent) { dragging.value = index ?? -1; event.dataTransfer?.setData('text/plain', String(index)); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move' },
    onDragend() { dragging.value = -1 },
    onDragover(event: DragEvent) { event.preventDefault() },
    onDrop(event: DragEvent) { event.preventDefault(); if (dragging.value >= 0 && index !== undefined) move(dragging.value, index); dragging.value = -1 }
  }
}
</script>
<template>
  <section aria-labelledby="collection-order-title">
    <div class="order-header"><h3 id="collection-order-title" class="order-title">阅读顺序</h3><a-space wrap><a-button type="primary" :disabled="disabled || !changed" @click="emit('save', ordered.map(item => item._id))">保存目录顺序</a-button><a-button v-if="changed" :disabled="disabled" @click="ordered = [...items]">还原顺序</a-button></a-space></div>
    <p class="order-hint" role="status">{{ changed ? '排序尚未保存。' : '拖动条目，或使用上移、下移按钮调整顺序。' }}</p>
    <a-table :data-source="ordered" :columns="columns" row-key="_id" :pagination="false" :custom-row="customRow" :scroll="{ x: 690 }" size="middle">
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'index'">{{ index + 1 }}</template>
        <template v-else-if="column.key === 'title'"><RouterLink :to="'/article/' + record._id">{{ record.title }}</RouterLink></template>
        <template v-else-if="column.key === 'actions'"><a-space :size="4" wrap>
          <a-button type="text" size="small" :disabled="disabled || index === 0" :aria-label="'上移 ' + record.title" @click="move(index, index - 1)"><ArrowUpOutlined />上移</a-button>
          <a-button type="text" size="small" :disabled="disabled || index === ordered.length - 1" :aria-label="'下移 ' + record.title" @click="move(index, index + 1)"><ArrowDownOutlined />下移</a-button>
          <RouterLink :to="'/editor/' + record._id">编辑</RouterLink>
          <a-button type="link" size="small" :disabled="disabled || changed" @click="emit('move', record._id)">移动到…</a-button>
          <a-popconfirm title="将此文章移出合集？文章会保留为独立文章。" @confirm="emit('remove', record._id)"><a-button type="link" size="small" :disabled="disabled || changed">移出合集</a-button></a-popconfirm>
        </a-space></template>
      </template>
      <template #emptyText><a-empty description="还没有收录文章，可以新建文章或收录已有文章。" /></template>
    </a-table>
  </section>
</template>
<style scoped>
.order-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.order-title { margin: 0; font-size: 16px; font-weight: 600; }
.order-hint { color: #8c8c8c; margin: 12px 0 16px; font-size: 13px; }
</style>
