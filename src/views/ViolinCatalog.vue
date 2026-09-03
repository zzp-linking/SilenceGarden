<template>
  <main class="violin-catalog-container garden-surface">
    <header class="garden-site-header">
      <router-link to="/" class="garden-brand" aria-label="回到静谧花园首页">
        <span class="garden-brand-seal" aria-hidden="true">静</span>
        <span class="garden-brand-text">
          <strong>静谧花园</strong>
          <small>Silence Garden</small>
        </span>
      </router-link>
      <nav class="garden-page-nav" aria-label="页面导航">
        <span class="garden-page-label">三 · 琴室 / SOUND</span>
        <router-link to="/" class="garden-page-link">回到题记</router-link>
      </nav>
    </header>

    <div class="garden-page-main violin-main">
      <section class="violin-hero">
        <div>
          <p class="garden-eyebrow">三 · 琴室 / SOUND</p>
          <h1 class="garden-hero-title">让旋律<br /><em>替沉默留路</em></h1>
          <p class="garden-hero-description">
            一些适合在园中独行时听的曲子。点开一首，播放器会带你去另一间房。
          </p>
          <div class="garden-index">
            <span>{{ catalog.length }} 首曲目</span>
            <span>默认静音，主动聆听</span>
          </div>
        </div>
        <div class="violin-hero-mark" aria-hidden="true">
          <span>♪</span>
          <small>ROOM<br />FOR<br />SOUND</small>
        </div>
      </section>

      <section class="violin-room" aria-labelledby="violin-list-title">
        <div class="violin-room-heading">
          <div>
            <span class="violin-room-kicker">LISTENING ROOM / 01</span>
            <h2 id="violin-list-title">曲目簿</h2>
          </div>
          <span class="violin-room-rule" aria-hidden="true"></span>
          <p>选择一首，进入播放器</p>
        </div>

        <div v-if="catalog.length" class="violin-list">
          <router-link
            v-for="(item, index) in catalog"
            :key="item._id || index"
            :to="'/violin/' + item._id"
            class="violin-entry"
          >
            <span class="violin-entry-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="violin-disc" aria-hidden="true">
              <img :src="srcJoin(item.disk_img)" alt="">
            </span>
            <span class="violin-entry-main">
              <strong>{{ item.name }}</strong>
              <span>{{ item.album || '未署名专辑' }}</span>
              <span v-if="item.tag && item.tag.length" class="violin-entry-tags">
                <i v-for="tag in item.tag" :key="tag">{{ tag }}</i>
              </span>
            </span>
            <span class="violin-entry-arrow" aria-hidden="true">↗</span>
          </router-link>
        </div>
        <p v-else class="violin-empty">琴弦还没有响起。</p>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useViolinStore } from '@/store/violin'
import { IMG } from '@/config/url'

const violinStore = useViolinStore()
const catalog = computed(() => violinStore.catalog)

const srcJoin = (src) => `${IMG}/violin/${src}`

onMounted(() => {
  violinStore.getVillinCatalog()
})
</script>

<style scoped lang="less">
@import '@/config/base.less';

.violin-catalog-container {
  font-family: @poem;
}

.violin-main {
  position: relative;
}

.violin-hero-mark {
  display: flex;
  align-items: center;
  gap: 18px;
  color: #5f806c;
}

.violin-hero-mark span {
  font-family: Georgia, serif;
  font-size: 124px;
  line-height: 0.7;
}

.violin-hero-mark small {
  color: #9aa79e;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  line-height: 1.8;
}

.violin-room {
  position: relative;
  padding: 34px clamp(20px, 5vw, 72px) 44px;
  color: #ecf0e7;
  background:
    radial-gradient(circle at 92% 8%, rgba(169, 192, 168, 0.2), transparent 20rem),
    #19221e;
  box-shadow: 18px 20px 0 rgba(49, 87, 70, 0.12);
}

.violin-room::after {
  position: absolute;
  right: 28px;
  bottom: 22px;
  width: 180px;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent, rgba(198, 161, 91, 0.7));
}

.violin-room-heading {
  display: grid;
  grid-template-columns: auto minmax(80px, 1fr) auto;
  gap: 22px;
  align-items: end;
  margin-bottom: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(169, 192, 168, 0.25);
}

.violin-room-kicker {
  color: #a9c0a8;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
}

.violin-room h2 {
  margin: 10px 0 0;
  font-size: 30px;
  font-weight: 400;
  letter-spacing: 0.14em;
}

.violin-room-heading p {
  margin: 0;
  color: #a9b8aa;
  font-size: 13px;
}

.violin-room-rule {
  height: 1px;
  background: rgba(198, 161, 91, 0.55);
}

.violin-entry {
  display: grid;
  grid-template-columns: 44px 66px minmax(0, 1fr) 32px;
  gap: 22px;
  align-items: center;
  min-height: 98px;
  padding: 15px 0;
  color: #ecf0e7;
  border-bottom: 1px solid rgba(169, 192, 168, 0.16);
  text-decoration: none;
  transition: padding 0.3s ease, background 0.3s ease, border-color 0.3s ease;
}

.violin-entry:hover {
  padding-right: 16px;
  padding-left: 16px;
  background: rgba(169, 192, 168, 0.08);
  border-color: rgba(198, 161, 91, 0.55);
}

.violin-entry:focus-visible {
  outline: 2px solid #c6a15b;
  outline-offset: -2px;
}

.violin-entry-index {
  color: #84988b;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
}

.violin-disc {
  position: relative;
  display: block;
  width: 66px;
  height: 66px;
  overflow: hidden;
  border: 1px solid rgba(198, 161, 91, 0.45);
  border-radius: 50%;
  background: #27342d;
  background-image: url('/home/assets/image/violin/catalog-disk-bg1.png');
  background-position: center;
  background-size: 170% 170%;
  background-repeat: no-repeat;
  animation: none;
  backface-visibility: hidden;
  transition: border-color 0.3s ease;
}

.violin-disc img {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: 170%;
  height: 170%;
  object-fit: cover;
  transform: translate(-50%, -50%);
  user-select: none;
}

.violin-entry:hover .violin-disc {
  border-color: #c6a15b;
  animation: disk-rotate 6s linear infinite;
}

.violin-entry-main {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.violin-entry-main strong {
  overflow: hidden;
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.violin-entry-main > span:not(.violin-entry-tags) {
  color: #a9b8aa;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.violin-entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.violin-entry-tags i {
  padding: 2px 8px;
  color: #d7c28b;
  border: 1px solid rgba(198, 161, 91, 0.4);
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 9px;
  font-style: normal;
}

.violin-entry-arrow {
  color: #c6a15b;
  font-family: Georgia, serif;
  font-size: 26px;
  text-align: right;
  transition: transform 0.3s ease;
}

.violin-entry:hover .violin-entry-arrow {
  transform: translate(4px, -4px);
}

.violin-empty {
  padding: 56px 0 36px;
  color: #a9b8aa;
  font-size: 18px;
  text-align: center;
}

@keyframes disk-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media only screen and (max-width: @threshold) {
  .violin-hero-mark {
    margin-top: 42px;
  }

  .violin-hero-mark span {
    font-size: 82px;
  }

  .violin-room {
    padding: 26px 16px 34px;
  }

  .violin-room-heading {
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .violin-room-rule {
    display: none;
  }

  .violin-room-heading p {
    grid-column: 1 / -1;
    margin-top: 10px;
  }

  .violin-entry {
    grid-template-columns: 28px 50px minmax(0, 1fr) 20px;
    gap: 10px;
    min-height: 82px;
  }

  .violin-disc {
    width: 50px;
    height: 50px;
  }

  .violin-entry:hover {
    padding-right: 8px;
    padding-left: 8px;
  }

  .violin-entry-main strong {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .violin-entry,
  .violin-disc,
  .violin-entry-arrow {
    transition: none;
  }

  .violin-disc {
    animation: none;
  }
}
</style>
