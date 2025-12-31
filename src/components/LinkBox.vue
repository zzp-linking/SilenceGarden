<template>
  <router-link :to="'/violin/' + violin._id" class="link-box-container">
    <div class="box clearfix">
      <div class="box-image">
        <img class="disk-img" :src="srcJoin(violin.disk_img)" alt="disk">
      </div>
      <div class="box-info">
        <div>
          <div class="title overflow-ellipsis" :title="violin.name">{{ violin.name }}</div>
        </div>
        <div class="album">{{ violin.album }}</div>
        <div class="tags">
          <span v-for="item in violin.tag" :key="item" class="violin-tag">{{ item }}</span>
        </div>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { IMG } from '@/config/url'

defineProps({
  violin: {
    type: Object,
    required: true
  }
})

const srcJoin = (src) => {
  return `${IMG}/violin/${src}`
}
</script>

<style lang="less" scoped>
@import '@/config/base.less';

.link-box-container {
  display: block;
  text-decoration: none;
}

.box {
  line-height: 1;
  background-color: rgba(105, 105, 105, 0.6);
  border-radius: 4px;
  padding: 5px 10px;
  display: flex;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  /* 恢复炫技：强制开启 3D 合成层，确保文字在任何状态下都保持一致的清晰度 */
  transform: translateZ(0);
  backface-visibility: hidden;
  
  &:hover {
    background-color: rgba(105, 105, 105, 0.85);
    transform: translateY(-4px) translateZ(0);
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
  }
}

.box-image {
  width: 90px;
  height: 90px;
  background-image: url('/assets/image/violin/catalog-disk-bg.png');
  background-size: 170% 170%;
  background-position: center;
  overflow: hidden;
  border-radius: 50%;
  flex-shrink: 0;
  animation: diskrotate 6s linear infinite;
  animation-play-state: paused;
}

.disk-img {
  margin-left: -35%;
  margin-top: -35%;
  width: 170%;
  height: 170%;
  user-select: none;
}

.box-info {
  flex: 1;
  margin-left: 15px;
  min-width: 0;
}

.title {
  color: #FFFFFF;
  font-size: 20px;
  margin-bottom: 8px;
  font-family: @poem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album {
  color: #ffc0cb;
  display: inline-block;
  padding: 2px 5px;
  border-radius: 4px;
  transition: all 0.3s;
  font-style: italic;
  font-size: 14px;
  margin-bottom: 8px;
  
  &:hover {
    background-color: #ffc0cb;
    color: #FFFFFF;
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.violin-tag {
  color: #D5E8FC;
  border: 1px solid #D5E8FC;
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 12px;
  transition: all 0.3s;
  
  &:hover {
    background-color: #D5E8FC;
    color: #008000;
  }
}

/* 仅保留这个你满意的反馈：鼠标移入时唱片转动 */
.link-box-container:hover .box-image {
  animation-play-state: running;
}

@keyframes diskrotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media only screen and (max-width: @threshold) {
  .box-image {
    width: 60px;
    height: 60px;
  }
  .title {
    font-size: 16px;
  }
  .album {
    font-size: 12px;
  }
}
</style>

