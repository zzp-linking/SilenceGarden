<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons-vue'
import { useArticleCollectionManager } from '@/composables/useArticleCollectionManager'
import CollectionMetadataForm from '@/components/article/CollectionMetadataForm.vue'
import CollectionOrderList from '@/components/article/CollectionOrderList.vue'
const manager = useArticleCollectionManager()
const articleToAdd = shallowRef<string | undefined>()
const movingId = shallowRef('')
const destination = shallowRef('')
const orderDirty = shallowRef(false)
const articleOptions = computed(() => manager.available.value.map(item => ({ value: item._id, label: item.title })))
const destinationOptions = computed(() => [{ value: '', label: '独立文章' }, ...manager.books.value.filter(item => item._id !== manager.selectedId.value).map(item => ({ value: item._id, label: item.title }))])
const metadataLocked = computed(() => manager.locked.value || orderDirty.value)
async function addArticle() {
  if (!articleToAdd.value) return
  await manager.add(articleToAdd.value)
  if (!manager.write.pending.value && !manager.write.error.value) articleToAdd.value = undefined
}
async function confirmMove() {
  await manager.changeMembership(movingId.value, destination.value || null)
  if (!manager.write.pending.value && !manager.write.error.value) movingId.value = ''
}
function selectBook(id: string) { articleToAdd.value = undefined; void manager.select(id) }
</script>
<template>
  <section class="admin-page" aria-label="文章合集管理">
    <header class="admin-page-head">
      <div><h1 class="admin-page-title">文章合集</h1><p class="admin-page-description">管理合集信息、文章归属与阅读顺序。</p></div>
      <a-space wrap><RouterLink to="/article"><a-button>查看目录</a-button></RouterLink><RouterLink to="/editor"><a-button><EditOutlined />新建文章</a-button></RouterLink><a-button type="primary" :disabled="metadataLocked" @click="selectBook('')"><PlusOutlined />新建合集</a-button><a-button :loading="manager.loading.value" :disabled="manager.write.busy.value || manager.write.pending.value || orderDirty" @click="manager.refresh()"><template #icon><ReloadOutlined /></template>刷新</a-button></a-space>
    </header>
    <a-alert v-if="manager.write.pending.value" type="warning" show-icon message="上次操作结果待确认，请先继续同步。"><template #action><a-button size="small" :loading="manager.write.busy.value" @click="manager.recover">确认结果／继续同步</a-button></template></a-alert>
    <a-alert v-if="manager.write.error.value" type="error" show-icon :message="manager.write.error.value" />
    <a-alert v-if="manager.loadError.value" type="error" show-icon :message="manager.loadError.value"><template #action><a-button size="small" :disabled="manager.write.pending.value" @click="manager.repair">检查并修复目录</a-button></template></a-alert>
    <a-alert v-if="orderDirty" type="warning" show-icon message="排序尚未保存，请先保存或还原顺序，再修改合集信息或收录文章。" />
    <a-row :gutter="[24, 24]">
      <a-col :xs="24" :xl="6">
        <a-card title="合集列表" :bordered="false" :loading="manager.loading.value && !manager.books.value.length">
          <a-list :data-source="manager.books.value" :locale="{ emptyText: '还没有合集' }">
            <template #renderItem="{ item }"><a-list-item><a-button block :type="item._id === manager.selectedId.value ? 'primary' : 'text'" class="book-option" :disabled="metadataLocked" @click="selectBook(item._id)"><span class="book-title">{{ item.title }}</span><span class="book-count">{{ item.articleCount }} 篇文章</span></a-button></a-list-item></template>
            
          </a-list>
        </a-card>
      </a-col>
      <a-col :xs="24" :xl="18">
        <a-spin :spinning="manager.loading.value || manager.write.busy.value">
          <div class="collection-panels">
            <a-card :title="manager.selectedId.value ? '合集信息' : '创建合集'" :bordered="false">
              <CollectionMetadataForm v-if="!manager.selectedId.value || manager.book.value" :key="manager.selectedId.value || 'create'" :title="manager.book.value?.title || ''" :description="manager.book.value?.description || ''" :disabled="metadataLocked" :submit-label="manager.selectedId.value ? '保存合集信息' : '创建合集'" @submit="manager.saveMetadata" />
              <a-empty v-else-if="!manager.loading.value" description="未能读取合集信息" />
            </a-card>
            <template v-if="manager.book.value">
              <a-card title="收录文章" :bordered="false">
                <template #extra><RouterLink :to="{ path: '/editor', query: { collectionId: manager.book.value._id } }">在此合集写文章</RouterLink></template>
                <a-form layout="vertical" @finish="addArticle"><a-form-item label="已有独立文章"><a-space wrap class="add-article"><a-select v-model:value="articleToAdd" show-search allow-clear option-filter-prop="label" :options="articleOptions" :disabled="metadataLocked" placeholder="搜索并选择文章" class="article-select" /><a-button html-type="submit" :disabled="metadataLocked || !articleToAdd">收录到末尾</a-button></a-space></a-form-item></a-form>
              </a-card>
              <a-card :bordered="false"><CollectionOrderList :items="manager.book.value.items" :disabled="manager.locked.value" @save="manager.saveOrder" @dirty="orderDirty = $event" @remove="manager.changeMembership($event, null)" @move="movingId = $event; destination = ''" /></a-card>
              <a-card size="small" :bordered="false"><div class="delete-book"><span class="admin-muted">删除合集前，请先移出全部文章。</span><a-popconfirm title="确认删除此空合集？" @confirm="manager.removeBook"><a-button danger :disabled="metadataLocked || manager.book.value.articleCount > 0">删除空合集</a-button></a-popconfirm></div></a-card>
            </template>
          </div>
        </a-spin>
      </a-col>
    </a-row>
    <a-modal :open="!!movingId" title="移动文章" ok-text="移动文章" :confirm-loading="manager.write.busy.value" :ok-button-props="{ disabled: manager.locked.value }" :mask-closable="!manager.write.busy.value" :closable="!manager.write.busy.value" @ok="confirmMove" @cancel="movingId = ''">
      <a-alert v-if="manager.write.error.value || manager.write.pending.value" type="warning" show-icon :message="manager.write.error.value || '操作结果待确认，请关闭弹窗后继续同步。'" class="move-alert" />
      <a-form layout="vertical"><a-form-item label="目标位置"><a-select v-model:value="destination" :options="destinationOptions" :disabled="manager.locked.value" /></a-form-item></a-form>
    </a-modal>
  </section>
</template>
<style scoped>
.collection-panels { display: grid; gap: 24px; min-width: 0; }
.book-option { height: auto; min-height: 48px; padding: 10px 12px; text-align: left; white-space: normal; }
.book-title { display: block; overflow-wrap: anywhere; }
.book-count { display: block; margin-top: 4px; font-size: 12px; opacity: .75; }
.article-select { width: min(360px, 100%); min-width: 220px; }
.add-article { max-width: 100%; }
.delete-book { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.move-alert { margin-bottom: 20px; }
@media (max-width: 767px) { .collection-panels { gap: 16px; } .article-select { width: 100%; min-width: 160px; } }
</style>
