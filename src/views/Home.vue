<template>
  <main
    class="garden-page"
    :class="{ 'is-sound-on': soundEnabled }"
    :style="pageStyle"
    @pointermove="handlePointerMove"
  >
    <audio ref="bgm" :src="`${AUDIO}/汐.mp3`" loop preload="none"></audio>

    <div class="paper-grain" aria-hidden="true"></div>
    <div class="ink-wash ink-wash-left" aria-hidden="true"></div>
    <div class="ink-wash ink-wash-right" aria-hidden="true"></div>

    <header class="garden-header">
      <a class="wordmark" href="#entrance" aria-label="返回静谧花园卷首">
        <span class="wordmark-seal" aria-hidden="true">静</span>
        <span class="wordmark-text">
          <strong>静谧花园</strong>
          <small>Silence Garden</small>
        </span>
      </a>

      <div class="header-note">一方未完之地</div>

      <button
        class="sound-toggle"
        type="button"
        :aria-pressed="soundEnabled"
        :aria-label="soundEnabled ? '关闭环境声音' : '开启环境声音'"
        @click="toggleSound"
      >
        <span class="sound-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>{{ soundEnabled ? '环境声已开' : '开启环境声' }}</span>
      </button>
    </header>

    <nav class="chapter-nav" aria-label="长卷章节导航">
      <span class="chapter-nav-caption">卷轴</span>
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="chapter-nav-link"
        :class="{ active: activeSection === section.id }"
        :aria-label="`前往${section.label}`"
        :aria-current="activeSection === section.id ? 'location' : undefined"
        @click.prevent="scrollToSection(section.id)"
      >
        <span class="chapter-nav-dot" aria-hidden="true"></span>
        <span class="chapter-nav-label">{{ section.label }}</span>
      </a>
    </nav>

    <section id="entrance" :ref="element => setSectionRef('entrance', element)" class="chapter chapter-entrance" :class="{ 'is-visible': revealedSections.has('entrance') }">
      <div class="entrance-landscape" aria-hidden="true">
        <span class="mountain mountain-back"></span>
        <span class="mountain mountain-mid"></span>
        <span class="mountain mountain-front"></span>
        <span class="bamboo bamboo-one"></span>
        <span class="bamboo bamboo-two"></span>
        <span class="mist mist-one"></span>
        <span class="mist mist-two"></span>
      </div>

      <div class="entrance-copy">
        <p class="eyebrow">卷首 · 入园</p>
        <h1>静谧<br /><em>花园</em></h1>
        <p class="entrance-quote">在喧响之外，留一处让念头慢慢生长的地方。</p>
        <a class="scroll-prompt" href="#preface" @click.prevent="scrollToSection('preface')">
          <span class="scroll-prompt-line" aria-hidden="true"></span>
          <span>向下展开长卷</span>
        </a>
      </div>

      <div class="entrance-inscription" aria-hidden="true">
        <span>古意</span>
        <span>新生</span>
        <span>自得</span>
      </div>

      <div class="hero-stamp" aria-label="Silence Garden 印章">
        <span>SG</span>
        <small>二〇二四 · 未完</small>
      </div>
    </section>

    <section id="preface" :ref="element => setSectionRef('preface', element)" class="chapter chapter-preface" :class="{ 'is-visible': revealedSections.has('preface') }">
      <div class="chapter-intro">
        <p class="eyebrow">一 · 题记</p>
        <h2>不求一览无余，<br /><em>只愿步步有景。</em></h2>
        <p class="chapter-lede">
          这里收着一些写下的字、听过的曲，也收着尚未长成的想法。你可以沿着长卷慢慢走，不必急着抵达终点。
        </p>
      </div>

      <div class="path-grid" aria-label="园中小径">
        <router-link v-for="path in gardenPaths" :key="path.title" :to="path.to" class="path-card">
          <span class="path-number">{{ path.number }}</span>
          <span class="path-symbol" :class="`path-symbol-${path.symbol}`" aria-hidden="true"></span>
          <span class="path-content">
            <small>{{ path.label }}</small>
            <strong>{{ path.title }}</strong>
            <span>{{ path.description }}</span>
          </span>
          <span class="path-arrow" aria-hidden="true">↗</span>
        </router-link>
      </div>
    </section>

    <section id="workshop" :ref="element => setSectionRef('workshop', element)" class="chapter chapter-workshop" :class="{ 'is-visible': revealedSections.has('workshop') }">
      <div class="workshop-backdrop" aria-hidden="true">
        <span class="workshop-orbit orbit-one"></span>
        <span class="workshop-orbit orbit-two"></span>
        <span class="workshop-orbit orbit-three"></span>
      </div>

      <div class="workshop-heading">
        <div>
          <p class="eyebrow">二 · 工坊</p>
          <h2>把念头做成<br /><em>可以触碰的东西。</em></h2>
        </div>
        <p class="chapter-lede">
          这里放着代码、开源项目和一些不肯安静待在纸面上的实验。它们是园林里的机关，也是另一种自我介绍。
        </p>
      </div>

      <article class="featured-toy">
        <div class="toy-copy">
          <p class="toy-kicker">工坊一 · 互动实验</p>
          <h3>天赐之福<br /><span>开箱推演</span></h3>
          <p class="toy-description">在概率与愿望之间，演算一次属于你的天意。</p>
          <div class="toy-actions">
            <a
              class="ink-button ink-button-primary"
              href="https://silencegarden.com/toys/%E5%A4%A9%E8%B5%90%E4%B9%8B%E7%A6%8F%C2%B7%E5%BC%80%E7%AE%B1%E6%8E%A8%E6%BC%94.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              进入工坊
              <span aria-hidden="true">↗</span>
            </a>
            <span class="toy-meta">HTML · JavaScript · 概率模拟</span>
          </div>
        </div>

        <div class="toy-preview" aria-label="天赐之福开箱推演预览">
          <div class="toy-preview-topline">
            <span>PROBABILITY LAB</span>
            <span>LIVE / 01</span>
          </div>
          <div class="toy-preview-title">
            <span class="toy-seal">福</span>
            <div>
              <small>天赐之福</small>
              <strong>开箱推演</strong>
            </div>
          </div>
          <div class="toy-crate" aria-hidden="true">
            <span class="crate-lid"></span>
            <span class="crate-box"></span>
            <span class="crate-glow"></span>
            <span class="crate-spark spark-one"></span>
            <span class="crate-spark spark-two"></span>
            <span class="crate-spark spark-three"></span>
          </div>
          <div class="toy-stats">
            <div><small>期望箱数</small><strong>18.6</strong></div>
            <div><small>目标完成</small><strong>72%</strong></div>
            <div><small>当前推演</small><strong>01</strong></div>
          </div>
          <div class="toy-progress"><span></span></div>
          <div class="toy-preview-footnote">让每一次开启，都有迹可循。</div>
        </div>
      </article>

      <div class="workshop-footer">
        <span>其余实验将在此处慢慢生长</span>
        <a href="#projects" @click.prevent="scrollToSection('projects')">查看工坊目录 <span aria-hidden="true">↓</span></a>
      </div>
    </section>

    <section id="projects" :ref="element => setSectionRef('projects', element)" class="chapter chapter-projects" :class="{ 'is-visible': revealedSections.has('projects') }">
      <div class="chapter-heading-row">
        <div>
          <p class="eyebrow">三 · 工坊目录</p>
          <h2>尚在生长的<br /><em>小型建筑。</em></h2>
        </div>
        <p class="chapter-lede">开源项目不必装饰成神秘的传说。它们有名字、有栖身之处，也有可以被再次使用的门。</p>
      </div>

      <div class="project-ledger">
        <a
          v-for="project in projects"
          :key="project.title"
          class="project-row"
          :href="project.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="project-index">{{ project.index }}</span>
          <span class="project-main">
            <strong>{{ project.title }}</strong>
            <span>{{ project.description }}</span>
          </span>
          <span class="project-stack">{{ project.stack }}</span>
          <span class="project-status">{{ project.status }}</span>
          <span class="project-arrow" aria-hidden="true">↗</span>
        </a>
      </div>

      <div class="ledger-note">
        <span class="ledger-note-line" aria-hidden="true"></span>
        <p>工坊尚未完工。下一件作品，等一个合适的念头。</p>
      </div>
    </section>

    <section id="afterglow" :ref="element => setSectionRef('afterglow', element)" class="chapter chapter-afterglow" :class="{ 'is-visible': revealedSections.has('afterglow') }">
      <div class="afterglow-pond" aria-hidden="true">
        <span class="pond-ring ring-one"></span>
        <span class="pond-ring ring-two"></span>
        <span class="pond-leaf leaf-one"></span>
        <span class="pond-leaf leaf-two"></span>
      </div>

      <div class="afterglow-copy">
        <p class="eyebrow">卷末 · 留步</p>
        <h2>花园没有<br /><em>真正的终点。</em></h2>
        <p class="chapter-lede">若有一处景色让你停留，欢迎下次再来。未完之物，才有继续生长的余地。</p>
        <a class="ink-button ink-button-outline" href="#entrance" @click.prevent="scrollToSection('entrance')">
          重返卷首
          <span aria-hidden="true">↑</span>
        </a>
      </div>

      <footer class="garden-footer">
        <span>Silence Garden</span>
        <span>静谧花园 · 未完待续</span>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { AUDIO } from '@/config/url'

const soundEnabled = ref(false)
const bgm = ref(null)
const activeSection = ref('entrance')
const revealedSections = ref(new Set(['entrance']))
const scrollOffset = ref(0)
const pointer = reactive({ x: 0, y: 0 })
  const sectionRefs = reactive({})
  let observer
  let scrollFrame
  let wheelIntent = 0
  let wheelResetTimer
  let pageUnlockTimer
  let isWheelPaging = false

const sections = [
  { id: 'entrance', label: '入园' },
  { id: 'preface', label: '题记' },
  { id: 'workshop', label: '工坊' },
  { id: 'projects', label: '目录' },
  { id: 'afterglow', label: '卷末' },
]

const gardenPaths = [
  {
    number: '01',
    label: '文字 · 文章',
    title: '砥砺',
    description: '写下那些尚未抵达的答案。',
    to: '/article',
    symbol: 'bamboo',
  },
  {
    number: '02',
    label: '文字 · 诗歌',
    title: '默书',
    description: '在旧句与新意之间停一停。',
    to: '/poetry',
    symbol: 'leaf',
  },
  {
    number: '03',
    label: '声音 · 琴室',
    title: '抚琴',
    description: '让一段旋律替沉默说话。',
    to: '/violin',
    symbol: 'string',
  },
]

const projects = [
  {
    index: '01',
    title: '天赐之福 · 开箱推演',
    description: '面向坦克世界开箱目标的概率模拟工具。',
    stack: 'HTML / JS',
    status: '在线',
    href: 'https://silencegarden.com/toys/%E5%A4%A9%E8%B5%90%E4%B9%8B%E7%A6%8F%C2%B7%E5%BC%80%E7%AE%B1%E6%8E%A8%E6%BC%94.html',
  },
]

const pageStyle = computed(() => ({
  '--pointer-x': `${pointer.x}px`,
  '--pointer-y': `${pointer.y}px`,
  '--scroll-y': `${scrollOffset.value}px`,
}))

function setSectionRef(id, element) {
  if (element) sectionRefs[id] = element
}

function handlePointerMove(event) {
  pointer.x = event.clientX
  pointer.y = event.clientY
}

function handleScroll() {
  if (scrollFrame) return

  scrollFrame = window.requestAnimationFrame(() => {
    scrollOffset.value = window.scrollY
    scrollFrame = undefined
  })
}

function getChapterElements() {
  return Object.values(sectionRefs)
    .filter(Boolean)
    .sort((a, b) => a.offsetTop - b.offsetTop)
}

function getCurrentChapterIndex(chapters) {
  const currentY = window.scrollY + window.innerHeight * 0.5
  return chapters.reduce((currentIndex, chapter, index) => (
    chapter.offsetTop <= currentY + 8 ? index : currentIndex
  ), 0)
}

function getWheelDelta(event) {
  const multiplier = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? window.innerHeight
      : 1

  return event.deltaY * multiplier
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pageWithWheel(direction) {
  const chapters = getChapterElements()
  const currentIndex = getCurrentChapterIndex(chapters)
  const nextIndex = currentIndex + (direction > 0 ? 1 : -1)

  if (!chapters[nextIndex]) return false

  isWheelPaging = true
  chapters[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.clearTimeout(pageUnlockTimer)
  pageUnlockTimer = window.setTimeout(() => {
    isWheelPaging = false
  }, 1000)
  return true
}

function handleWheel(event) {
  if (window.innerWidth <= 700 || prefersReducedMotion() || event.ctrlKey) return
  if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return

  if (isWheelPaging) {
    event.preventDefault()
    return
  }

  const delta = getWheelDelta(event)
  if (!delta) return

  const chapters = getChapterElements()
  const currentIndex = getCurrentChapterIndex(chapters)
  const direction = Math.sign(delta)
  const nextIndex = currentIndex + (direction > 0 ? 1 : -1)

  // At either end, preserve the browser's normal overscroll behavior.
  if (!chapters[nextIndex]) {
    wheelIntent = 0
    return
  }

  // Hold the wheel gesture until it expresses enough intent to advance one chapter.
  event.preventDefault()
  if (wheelIntent && Math.sign(wheelIntent) !== direction) wheelIntent = 0
  wheelIntent += delta

  window.clearTimeout(wheelResetTimer)
  wheelResetTimer = window.setTimeout(() => {
    wheelIntent = 0
  }, 240)

  if (Math.abs(wheelIntent) >= 64) {
    wheelIntent = 0
    pageWithWheel(direction)
  }
}

function handleScrollEnd() {
  if (!isWheelPaging) return
  window.clearTimeout(pageUnlockTimer)
  isWheelPaging = false
}

function scrollToSection(id) {
  const target = sectionRefs[id]
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function toggleSound() {
  if (!bgm.value) return

  if (soundEnabled.value) {
    bgm.value.pause()
    soundEnabled.value = false
    return
  }

  try {
    await bgm.value.play()
    soundEnabled.value = true
  } catch (error) {
    soundEnabled.value = false
    console.info('Ambient audio is unavailable until the browser allows playback.', error)
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          revealedSections.value = new Set([...revealedSections.value, entry.target.id])
        }
      })

      if (visible[0]?.target?.id) activeSection.value = visible[0].target.id
    },
    { threshold: [0.2, 0.45, 0.7], rootMargin: '-12% 0px -35% 0px' },
  )

    Object.values(sectionRefs).forEach(section => section && observer.observe(section))
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('scrollend', handleScrollEnd)
    handleScroll()
})

onBeforeUnmount(() => {
    observer?.disconnect()
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('wheel', handleWheel)
    window.removeEventListener('scrollend', handleScrollEnd)
    window.clearTimeout(wheelResetTimer)
    window.clearTimeout(pageUnlockTimer)
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
  })
</script>

<style lang="less" scoped>
@paper: #f2eee3;
@paper-deep: #e6e1d3;
@ink: #1e2924;
@ink-soft: #405149;
@ink-faded: #6f7c70;
@green: #5f806c;
@green-deep: #315746;
@green-light: #a9c0a8;
@line: rgba(49, 87, 70, 0.2);
@red-seal: #a94737;
@dark-panel: #171d1b;
@dark-panel-soft: #202b27;
@gold: #d4ad62;

@font-face {
  font-family: 'SilenceHand';
  src: url('@/assets/font/信笺手写体.woff') format('woff');
  font-display: swap;
}

:global(html) {
  scroll-behavior: smooth;
  scroll-snap-type: y proximity;
  background: @paper;
}

:global(body) {
  margin: 0;
  background: @paper;
  overscroll-behavior-y: none;
}

:global(#app),
:global(#app-content) {
  min-height: 100%;
}

.garden-page {
  position: relative;
  overflow: hidden;
  --scroll-y: 0px;
  color: @ink;
  background:
    radial-gradient(circle at var(--pointer-x) var(--pointer-y), rgba(95, 128, 108, 0.08), transparent 20rem),
    @paper;
  font-family: 'Songti SC', 'STSong', 'SimSun', serif;
  isolation: isolate;
}

.paper-grain {
  position: fixed;
  z-index: 20;
  inset: 0;
  pointer-events: none;
  opacity: 0.22;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}

.ink-wash {
  position: fixed;
  z-index: -1;
  width: 38rem;
  height: 38rem;
  pointer-events: none;
  opacity: 0.16;
  filter: blur(1px);
  background: radial-gradient(ellipse at center, rgba(49, 87, 70, 0.22) 0%, rgba(49, 87, 70, 0.05) 38%, transparent 70%);
}

.ink-wash-left {
  top: 8%;
  left: -26rem;
  transform: rotate(-24deg);
}

.ink-wash-right {
  top: 54%;
  right: -27rem;
  transform: rotate(24deg);
}

.garden-header {
  position: fixed;
  z-index: 15;
  top: 2.2rem;
  right: 4.5vw;
  left: 4.5vw;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  pointer-events: none;
}

.wordmark,
.sound-toggle {
  pointer-events: auto;
}

.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: @ink;
  text-decoration: none;
}

.wordmark-seal {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  color: @paper;
  background: @red-seal;
  border-radius: 2px;
  font-family: 'SilenceHand', serif;
  font-size: 1.35rem;
  line-height: 1;
  transform: rotate(-7deg);
}

.wordmark-text {
  display: grid;
  gap: 0.12rem;
}

.wordmark-text strong {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.22em;
}

.wordmark-text small,
.header-note,
.sound-toggle,
.chapter-nav,
.eyebrow,
.toy-kicker,
.toy-meta,
.toy-preview,
.project-stack,
.project-status,
.garden-footer {
  font-family: 'Segoe UI', 'Microsoft YaHei UI', sans-serif;
}

.wordmark-text small {
  color: @ink-faded;
  font-size: 0.57rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.header-note {
  color: @ink-faded;
  font-size: 0.68rem;
  letter-spacing: 0.32em;
}

.sound-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.8rem;
  color: @ink-soft;
  background: rgba(242, 238, 227, 0.62);
  border: 1px solid @line;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  transition: background 220ms ease, color 220ms ease, border-color 220ms ease;
}

.sound-toggle:hover,
.sound-toggle:focus-visible {
  color: @green-deep;
  background: rgba(255, 255, 255, 0.78);
  border-color: rgba(49, 87, 70, 0.46);
}

.sound-toggle:focus-visible,
.wordmark:focus-visible,
.chapter-nav-link:focus-visible,
.path-card:focus-visible,
.ink-button:focus-visible,
.project-row:focus-visible,
.scroll-prompt:focus-visible {
  outline: 2px solid @green-deep;
  outline-offset: 5px;
}

.sound-mark {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 0.75rem;
}

.sound-mark i {
  display: block;
  width: 1px;
  height: 0.42rem;
  background: currentColor;
}

.sound-mark i:nth-child(2) {
  height: 0.72rem;
}

.sound-mark i:nth-child(3) {
  height: 0.56rem;
}

.is-sound-on .sound-mark i {
  animation: soundPulse 1.2s ease-in-out infinite alternate;
}

.is-sound-on .sound-mark i:nth-child(2) {
  animation-delay: -0.4s;
}

.is-sound-on .sound-mark i:nth-child(3) {
  animation-delay: -0.75s;
}

.chapter-nav {
  position: fixed;
  z-index: 15;
  top: 50%;
  right: 2.1vw;
  display: grid;
  gap: 0.9rem;
  transform: translateY(-50%);
}

.chapter-nav-caption {
  margin-bottom: 0.25rem;
  color: @ink-faded;
  font-size: 0.55rem;
  letter-spacing: 0.2em;
  writing-mode: vertical-rl;
}

.chapter-nav-link {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 1.25rem;
  color: @ink-faded;
  text-decoration: none;
}

.chapter-nav-dot {
  display: block;
  width: 0.42rem;
  height: 0.42rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  transition: transform 220ms ease, background 220ms ease, border-color 220ms ease;
}

.chapter-nav-label {
  position: absolute;
  right: 1rem;
  color: @green-deep;
  opacity: 0;
  font-size: 0.62rem;
  letter-spacing: 0.15em;
  white-space: nowrap;
  transition: opacity 220ms ease, transform 220ms ease;
  transform: translateX(0.4rem);
}

.chapter-nav-link:hover .chapter-nav-label,
.chapter-nav-link.active .chapter-nav-label {
  opacity: 1;
  transform: translateX(0);
}

.chapter-nav-link.active .chapter-nav-dot {
  background: @green;
  border-color: @green;
  transform: scale(1.6);
}

.chapter {
  position: relative;
  min-height: 100vh;
  padding: 10rem 13vw 9rem 10vw;
  scroll-margin-top: 0;
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}

.chapter-entrance {
  display: grid;
  min-height: 100svh;
  align-items: center;
  padding-top: 7rem;
  padding-bottom: 5rem;
}

.entrance-landscape {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.mountain {
  position: absolute;
  right: -6vw;
  bottom: 0;
  width: 78vw;
  height: 63%;
  opacity: 0.3;
  background: @green-light;
  clip-path: polygon(0 100%, 13% 68%, 26% 76%, 42% 36%, 55% 63%, 71% 18%, 82% 43%, 100% 0, 100% 100%);
  filter: blur(0.2px);
}

.mountain-back {
  right: -18vw;
  bottom: 8%;
  opacity: 0.15;
  transform: translate3d(0, calc(var(--scroll-y) * -0.035), 0) scale(1.16);
}

.mountain-mid {
  right: -4vw;
  opacity: 0.18;
  transform: translate3d(0, calc(var(--scroll-y) * -0.02), 0) scale(0.93) translateY(8%);
}

.mountain-front {
  right: 4vw;
  bottom: -2%;
  width: 58vw;
  height: 42%;
  opacity: 0.11;
  transform: translate3d(0, calc(var(--scroll-y) * -0.012), 0) scale(0.84) rotate(1deg);
}

.mist {
  position: absolute;
  right: 3vw;
  bottom: 25%;
  width: 55vw;
  height: 7rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  filter: blur(18px);
  transform: translate3d(0, calc(var(--scroll-y) * -0.018), 0) rotate(-4deg);
}

.mist-two {
  right: 15vw;
  bottom: 36%;
  width: 32vw;
  opacity: 0.55;
  transform: translate3d(0, calc(var(--scroll-y) * -0.01), 0) rotate(5deg);
}

.bamboo {
  position: absolute;
  bottom: -1rem;
  left: 7vw;
  width: 0.24rem;
  height: 36vh;
  opacity: 0.3;
  background: @green-deep;
  transform: rotate(7deg);
  transform-origin: bottom;
}

.bamboo::before,
.bamboo::after {
  position: absolute;
  left: -2.2rem;
  width: 3.5rem;
  height: 1rem;
  border-top: 1px solid @green-deep;
  border-radius: 50%;
  content: '';
}

.bamboo::before {
  top: 3rem;
  transform: rotate(22deg);
}

.bamboo::after {
  top: 8rem;
  left: -1rem;
  transform: rotate(-18deg);
}

.bamboo-two {
  bottom: -3rem;
  left: 12vw;
  height: 26vh;
  opacity: 0.18;
  transform: rotate(-12deg);
}

.entrance-copy {
  position: relative;
  z-index: 1;
  width: min(38rem, 60vw);
  margin-left: 8vw;
}

.eyebrow {
  margin: 0 0 1.35rem;
  color: @green;
  font-size: 0.68rem;
  letter-spacing: 0.3em;
}

.entrance-copy h1,
.chapter h2,
.workshop-heading h2,
.chapter-heading-row h2,
.afterglow-copy h2 {
  margin: 0;
  font-family: 'SilenceHand', 'STKaiti', 'KaiTi', serif;
  font-weight: 400;
  line-height: 0.95;
}

.entrance-copy h1 {
  color: @ink;
  font-size: clamp(5.5rem, 12vw, 11.5rem);
  letter-spacing: -0.08em;
}

.entrance-copy h1 em,
.chapter h2 em,
.workshop-heading h2 em,
.chapter-heading-row h2 em,
.afterglow-copy h2 em {
  color: @green-deep;
  font-style: normal;
}

.entrance-quote {
  max-width: 20rem;
  margin: 2.2rem 0 0 0.6rem;
  color: @ink-soft;
  font-size: 1rem;
  line-height: 2;
  letter-spacing: 0.12em;
}

.scroll-prompt {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin: 5rem 0 0 0.6rem;
  color: @green-deep;
  font-family: 'Segoe UI', 'Microsoft YaHei UI', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-decoration: none;
}

.scroll-prompt-line {
  position: relative;
  display: block;
  width: 3.2rem;
  height: 1px;
  background: @green;
}

.scroll-prompt-line::after {
  position: absolute;
  top: -2px;
  right: 0;
  width: 5px;
  height: 5px;
  border-right: 1px solid @green;
  border-bottom: 1px solid @green;
  content: '';
  transform: rotate(45deg);
}

.entrance-inscription {
  position: absolute;
  right: 14vw;
  bottom: 12%;
  display: grid;
  gap: 0.9rem;
  color: @green-deep;
  font-family: 'SilenceHand', serif;
  font-size: clamp(1.3rem, 2vw, 2rem);
  line-height: 1;
  writing-mode: vertical-rl;
  opacity: 0.62;
}

.entrance-inscription span:nth-child(2) {
  color: @red-seal;
}

.hero-stamp {
  position: absolute;
  right: 24vw;
  bottom: 15%;
  display: grid;
  width: 4.3rem;
  height: 4.3rem;
  place-items: center;
  color: @red-seal;
  border: 1px solid @red-seal;
  border-radius: 2px;
  opacity: 0.74;
  transform: rotate(9deg);
}

.hero-stamp span {
  font-family: 'SilenceHand', serif;
  font-size: 2.2rem;
  line-height: 1;
}

.hero-stamp small {
  position: absolute;
  bottom: -1.1rem;
  color: @ink-faded;
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.48rem;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.chapter-preface {
  display: grid;
  grid-template-columns: minmax(15rem, 0.65fr) minmax(30rem, 1fr);
  align-items: center;
  gap: clamp(4rem, 10vw, 11rem);
  background: linear-gradient(180deg, transparent, rgba(169, 192, 168, 0.07));
}

.chapter h2,
.workshop-heading h2,
.chapter-heading-row h2,
.afterglow-copy h2 {
  font-size: clamp(3.1rem, 5vw, 5.4rem);
  letter-spacing: -0.06em;
}

.chapter-lede {
  max-width: 22rem;
  margin: 2rem 0 0;
  color: @ink-faded;
  font-size: 0.95rem;
  line-height: 2.1;
  letter-spacing: 0.08em;
}

.path-grid {
  display: grid;
  gap: 0;
  border-top: 1px solid @line;
}

.path-card {
  position: relative;
  display: grid;
  grid-template-columns: 2.6rem 3rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 1.35rem;
  min-height: 8.2rem;
  padding: 1rem 0.8rem;
  color: @ink;
  border-bottom: 1px solid @line;
  text-decoration: none;
  transition: padding 280ms ease, background 280ms ease;
}

.path-card:hover {
  padding-right: 1.5rem;
  padding-left: 1.5rem;
  background: rgba(255, 255, 255, 0.44);
}

.path-number {
  align-self: start;
  padding-top: 0.45rem;
  color: @ink-faded;
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.64rem;
  letter-spacing: 0.16em;
}

.path-symbol {
  position: relative;
  display: block;
  width: 2.8rem;
  height: 2.8rem;
  opacity: 0.65;
}

.path-symbol-bamboo::before,
.path-symbol-bamboo::after {
  position: absolute;
  bottom: 0;
  left: 1.1rem;
  width: 1px;
  height: 2.8rem;
  background: @green-deep;
  content: '';
  transform: rotate(17deg);
}

.path-symbol-bamboo::after {
  left: 0.8rem;
  height: 2.1rem;
  transform: rotate(-19deg);
}

.path-symbol-leaf {
  border: 1px solid @green;
  border-radius: 100% 0 100% 0;
  transform: rotate(-35deg) scale(0.7);
}

.path-symbol-leaf::after {
  position: absolute;
  top: 0.5rem;
  left: 1.3rem;
  width: 1px;
  height: 2rem;
  background: @green;
  content: '';
  transform: rotate(45deg);
}

.path-symbol-string::before,
.path-symbol-string::after {
  position: absolute;
  top: 0.15rem;
  left: 0.65rem;
  width: 1px;
  height: 2.6rem;
  background: @green-deep;
  box-shadow: 0.65rem 0 0 @green-deep, 1.3rem 0 0 @green-deep;
  content: '';
  transform: rotate(8deg);
}

.path-symbol-string::after {
  top: 1.2rem;
  left: 0.1rem;
  width: 2.6rem;
  height: 1px;
  background: @green;
  box-shadow: none;
  transform: rotate(-18deg);
}

.path-content {
  display: grid;
  gap: 0.35rem;
}

.path-content small {
  color: @green;
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.61rem;
  letter-spacing: 0.16em;
}

.path-content strong {
  font-family: 'SilenceHand', serif;
  font-size: 2rem;
  font-weight: 400;
}

.path-content > span {
  color: @ink-faded;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
}

.path-arrow,
.project-arrow {
  color: @green;
  font-family: 'Segoe UI', sans-serif;
  font-size: 1.25rem;
  transition: transform 220ms ease, color 220ms ease;
}

.path-card:hover .path-arrow,
.project-row:hover .project-arrow {
  color: @green-deep;
  transform: translate(0.2rem, -0.2rem);
}

.chapter-workshop {
  color: @paper;
  background: @dark-panel;
}

.workshop-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.workshop-orbit {
  position: absolute;
  border: 1px solid rgba(212, 173, 98, 0.16);
  border-radius: 50%;
  transform: translate3d(0, calc(var(--scroll-y) * -0.016), 0) rotate(-24deg);
}

.orbit-one {
  top: 8%;
  right: -4vw;
  width: 38vw;
  height: 38vw;
}

.orbit-two {
  top: 19%;
  right: 3vw;
  width: 27vw;
  height: 27vw;
}

.orbit-three {
  top: 31%;
  right: 11vw;
  width: 12vw;
  height: 12vw;
  border-color: rgba(169, 192, 168, 0.22);
}

.workshop-heading,
.chapter-heading-row {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(16rem, 0.8fr) minmax(18rem, 0.7fr);
  align-items: end;
  gap: 5rem;
}

.chapter-workshop .eyebrow {
  color: @gold;
}

.chapter-workshop h2,
.chapter-workshop .chapter-lede {
  color: @paper;
}

.chapter-workshop .chapter-lede {
  color: rgba(242, 238, 227, 0.62);
}

.featured-toy {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(18rem, 0.7fr) minmax(24rem, 1fr);
  gap: clamp(3rem, 8vw, 9rem);
  align-items: center;
  max-width: 76rem;
  margin-top: 7rem;
  padding: clamp(1.5rem, 4vw, 4rem);
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.015));
  border: 1px solid rgba(212, 173, 98, 0.22);
}

.toy-kicker {
  margin: 0 0 1.5rem;
  color: @gold;
  font-size: 0.65rem;
  letter-spacing: 0.22em;
}

.toy-copy h3 {
  margin: 0;
  color: @paper;
  font-family: 'SilenceHand', 'STKaiti', serif;
  font-size: clamp(3.5rem, 5.5vw, 6.3rem);
  font-weight: 400;
  line-height: 0.94;
  letter-spacing: -0.08em;
}

.toy-copy h3 span {
  color: @gold;
}

.toy-description {
  max-width: 16rem;
  margin: 2rem 0 0;
  color: rgba(242, 238, 227, 0.66);
  font-size: 0.95rem;
  line-height: 1.9;
  letter-spacing: 0.1em;
}

.toy-actions {
  display: grid;
  justify-items: start;
  gap: 1rem;
  margin-top: 2.5rem;
}

.ink-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  min-height: 2.8rem;
  padding: 0.55rem 1.1rem;
  border: 1px solid currentColor;
  font-family: 'Segoe UI', 'Microsoft YaHei UI', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-decoration: none;
  transition: background 220ms ease, color 220ms ease, transform 220ms ease;
}

.ink-button:hover {
  transform: translateY(-2px);
}

.ink-button-primary {
  color: @dark-panel;
  background: @gold;
  border-color: @gold;
}

.ink-button-primary:hover {
  color: @dark-panel;
  background: #efd18a;
}

.ink-button-outline {
  color: @green-deep;
  background: transparent;
}

.ink-button-outline:hover {
  color: @paper;
  background: @green-deep;
}

.toy-meta {
  color: rgba(242, 238, 227, 0.42);
  font-size: 0.58rem;
  letter-spacing: 0.09em;
}

.toy-preview {
  position: relative;
  min-height: 25rem;
  padding: 1.3rem;
  color: @paper;
  background:
    radial-gradient(circle at 50% 38%, rgba(212, 173, 98, 0.12), transparent 34%),
    @dark-panel-soft;
  border: 1px solid rgba(212, 173, 98, 0.25);
  box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.22);
}

.toy-preview-topline,
.toy-stats,
.toy-preview-footnote {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(242, 238, 227, 0.42);
  font-size: 0.54rem;
  letter-spacing: 0.16em;
}

.toy-preview-title {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 2rem;
}

.toy-seal {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  color: @gold;
  border: 1px solid @gold;
  border-radius: 2px;
  font-family: 'SilenceHand', serif;
  font-size: 1.35rem;
}

.toy-preview-title div {
  display: grid;
  gap: 0.22rem;
}

.toy-preview-title small {
  color: @gold;
  font-size: 0.6rem;
  letter-spacing: 0.16em;
}

.toy-preview-title strong {
  font-family: 'SilenceHand', serif;
  font-size: 1.4rem;
  font-weight: 400;
  letter-spacing: 0.08em;
}

.toy-crate {
  position: relative;
  display: grid;
  width: 10.5rem;
  height: 9.5rem;
  margin: 2rem auto 1rem;
  place-items: center;
}

.crate-box,
.crate-lid {
  position: absolute;
  display: block;
  width: 6.2rem;
  height: 4.7rem;
  border: 1px solid @gold;
  background: linear-gradient(135deg, rgba(224, 180, 90, 0.3), rgba(82, 62, 35, 0.25));
  transform: perspective(8rem) rotateX(12deg) rotateY(-23deg) rotateZ(3deg);
}

.crate-box::before,
.crate-box::after {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(224, 180, 90, 0.5);
  content: '';
}

.crate-box::before {
  left: 1.75rem;
}

.crate-box::after {
  right: 1.7rem;
}

.crate-lid {
  top: 1.5rem;
  width: 6.5rem;
  height: 1.2rem;
  transform: perspective(8rem) rotateX(12deg) rotateY(-23deg) rotateZ(3deg) translateY(-2.5rem) translateX(0.1rem);
}

.crate-glow {
  position: absolute;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  background: rgba(224, 180, 90, 0.35);
  filter: blur(18px);
  animation: crateGlow 3s ease-in-out infinite alternate;
}

.crate-spark {
  position: absolute;
  width: 0.28rem;
  height: 0.28rem;
  background: @gold;
  transform: rotate(45deg);
}

.spark-one {
  top: 1.3rem;
  right: 1.4rem;
}

.spark-two {
  top: 3rem;
  left: 0.6rem;
  width: 0.18rem;
  height: 0.18rem;
}

.spark-three {
  right: 0.9rem;
  bottom: 1.7rem;
  width: 0.18rem;
  height: 0.18rem;
}

.toy-stats {
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(212, 173, 98, 0.16);
}

.toy-stats div {
  display: grid;
  gap: 0.35rem;
}

.toy-stats strong {
  color: @gold;
  font-family: 'Cascadia Mono', 'Consolas', monospace;
  font-size: 1rem;
  font-weight: 400;
}

.toy-progress {
  height: 2px;
  margin-top: 1.4rem;
  overflow: hidden;
  background: rgba(242, 238, 227, 0.12);
}

.toy-progress span {
  display: block;
  width: 72%;
  height: 100%;
  background: @gold;
}

.toy-preview-footnote {
  margin-top: 1.2rem;
  color: rgba(242, 238, 227, 0.4);
}

.workshop-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  margin-top: 3.5rem;
  color: rgba(242, 238, 227, 0.46);
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
}

.workshop-footer a {
  color: @green-light;
  text-decoration: none;
}

.workshop-footer a:hover {
  color: @paper;
}

.chapter-projects {
  display: grid;
  align-content: center;
  background: rgba(255, 255, 255, 0.18);
}

.chapter-projects .chapter-lede {
  max-width: 20rem;
}

.project-ledger {
  margin-top: 6rem;
  border-top: 1px solid @line;
}

.project-row {
  display: grid;
  grid-template-columns: 3rem minmax(15rem, 1fr) 7rem 4rem 1rem;
  align-items: center;
  gap: 1.25rem;
  min-height: 7.5rem;
  padding: 1rem 0.8rem;
  color: @ink;
  border-bottom: 1px solid @line;
  text-decoration: none;
  transition: background 220ms ease, padding 220ms ease;
}

.project-row:hover {
  padding-right: 1.4rem;
  padding-left: 1.4rem;
  background: rgba(255, 255, 255, 0.58);
}

.project-index,
.project-stack,
.project-status {
  color: @ink-faded;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.project-main {
  display: grid;
  gap: 0.45rem;
}

.project-main strong {
  font-family: 'SilenceHand', serif;
  font-size: 1.7rem;
  font-weight: 400;
}

.project-main span {
  color: @ink-faded;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
}

.project-status {
  color: @green-deep;
}

.project-arrow {
  justify-self: end;
}

.ledger-note {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 3rem;
  color: @ink-faded;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
}

.ledger-note p {
  margin: 0;
}

.ledger-note-line {
  width: 3.5rem;
  height: 1px;
  background: @green;
}

.chapter-afterglow {
  display: grid;
  min-height: 95vh;
  align-content: center;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(169, 192, 168, 0.1), rgba(95, 128, 108, 0.16));
}

.afterglow-copy {
  position: relative;
  z-index: 1;
  margin-left: 9vw;
}

.afterglow-copy .chapter-lede {
  max-width: 19rem;
}

.afterglow-copy .ink-button {
  margin-top: 2.5rem;
}

.afterglow-pond {
  position: absolute;
  top: 18%;
  right: 3vw;
  width: min(42rem, 46vw);
  height: min(42rem, 46vw);
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.74), rgba(169, 192, 168, 0.2) 48%, transparent 70%);
  transform: translate3d(0, calc(var(--scroll-y) * 0.012), 0) rotate(-14deg);
}

.pond-ring {
  position: absolute;
  border: 1px solid rgba(49, 87, 70, 0.3);
  border-radius: 50%;
}

.ring-one {
  top: 28%;
  left: 13%;
  width: 67%;
  height: 41%;
}

.ring-two {
  top: 35%;
  left: 24%;
  width: 44%;
  height: 25%;
}

.pond-leaf {
  position: absolute;
  width: 8rem;
  height: 3.4rem;
  border: 1px solid @green-deep;
  border-radius: 100% 0 100% 0;
  opacity: 0.42;
}

.leaf-one {
  top: 33%;
  left: 42%;
  transform: rotate(18deg);
}

.leaf-two {
  top: 49%;
  left: 20%;
  transform: scale(0.68) rotate(-34deg);
}

.garden-footer {
  position: absolute;
  right: 4.5vw;
  bottom: 2.2rem;
  left: 4.5vw;
  display: flex;
  justify-content: space-between;
  color: rgba(49, 87, 70, 0.62);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.chapter-intro,
.path-grid,
.workshop-heading,
.featured-toy,
.chapter-heading-row,
.project-ledger,
.ledger-note,
.afterglow-copy {
  opacity: 0;
  transform: translate3d(0, 1.5rem, 0);
  transition: opacity 720ms ease, transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
}

.path-grid,
.featured-toy,
.project-ledger,
.ledger-note {
  transition-delay: 120ms;
}

.chapter.is-visible .chapter-intro,
.chapter.is-visible .path-grid,
.chapter.is-visible .workshop-heading,
.chapter.is-visible .featured-toy,
.chapter.is-visible .chapter-heading-row,
.chapter.is-visible .project-ledger,
.chapter.is-visible .ledger-note,
.chapter.is-visible .afterglow-copy {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

@keyframes soundPulse {
  from { transform: scaleY(0.65); }
  to { transform: scaleY(1.15); }
}

@keyframes crateGlow {
  from { opacity: 0.38; transform: scale(0.86); }
  to { opacity: 0.75; transform: scale(1.12); }
}

@media (max-width: 1000px) {
  .chapter {
    padding-right: 10vw;
    padding-left: 8vw;
  }

  .chapter-preface,
  .workshop-heading,
  .chapter-heading-row {
    grid-template-columns: 1fr;
    gap: 3rem;
  }

  .chapter-preface {
    align-content: center;
  }

  .featured-toy {
    gap: 3rem;
  }

  .hero-stamp {
    right: 18vw;
  }
}

@media (min-width: 701px) {
  .chapter {
    height: 100svh;
    min-height: 42rem;
    overflow: hidden;
  }

  .chapter-preface {
    gap: 4rem;
    padding-top: 6.8rem;
    padding-bottom: 4.4rem;
  }

  .chapter-preface .path-card {
    min-height: 5.25rem;
  }

  .chapter-preface .path-content strong {
    font-size: 1.7rem;
  }

  .chapter-workshop {
    padding-top: 6.8rem;
    padding-bottom: 3.2rem;
  }

  .featured-toy {
    margin-top: 3rem;
    padding: 2.2rem;
  }

  .toy-preview {
    min-height: 22rem;
  }

  .workshop-footer {
    margin-top: 2.2rem;
  }

  .chapter-projects {
    padding-top: 6.8rem;
    padding-bottom: 4rem;
  }

  .project-ledger {
    margin-top: 3rem;
  }
}

@media (max-width: 700px) {
  :global(html) {
    scroll-snap-type: y proximity;
  }

  .garden-header {
    top: 1.2rem;
    right: 1.25rem;
    left: 1.25rem;
  }

  .header-note,
  .chapter-nav,
  .sound-toggle span:last-child {
    display: none;
  }

  .sound-toggle {
    width: 2.35rem;
    height: 2.35rem;
    justify-content: center;
    padding: 0;
  }

  .chapter {
    min-height: auto;
    scroll-snap-stop: normal;
    padding: 8.5rem 1.35rem 6rem;
  }

  .chapter-entrance {
    min-height: 100svh;
    padding-top: 6rem;
    padding-bottom: 4rem;
  }

  .entrance-copy {
    width: auto;
    margin: 0 0 0 4vw;
  }

  .entrance-copy h1 {
    font-size: clamp(5rem, 23vw, 8.2rem);
  }

  .entrance-quote {
    max-width: 14rem;
    margin-top: 1.6rem;
    font-size: 0.83rem;
  }

  .scroll-prompt {
    margin-top: 4rem;
  }

  .entrance-inscription {
    right: 8vw;
    bottom: 13%;
    font-size: 1.05rem;
  }

  .hero-stamp {
    right: 15vw;
    bottom: 10%;
    width: 3.2rem;
    height: 3.2rem;
  }

  .hero-stamp span {
    font-size: 1.7rem;
  }

  .chapter h2,
  .workshop-heading h2,
  .chapter-heading-row h2,
  .afterglow-copy h2 {
    font-size: clamp(2.8rem, 13vw, 4.2rem);
  }

  .chapter-lede {
    margin-top: 1.5rem;
    font-size: 0.84rem;
    line-height: 1.9;
  }

  .path-card {
    grid-template-columns: 2rem 2.2rem minmax(0, 1fr) 1rem;
    gap: 0.8rem;
    min-height: 7.2rem;
    padding-right: 0;
    padding-left: 0;
  }

  .path-card:hover {
    padding-right: 0.4rem;
    padding-left: 0.4rem;
  }

  .path-symbol {
    transform: scale(0.8);
  }

  .path-content strong {
    font-size: 1.6rem;
  }

  .path-content > span {
    font-size: 0.7rem;
  }

  .featured-toy {
    grid-template-columns: 1fr;
    gap: 3rem;
    margin-top: 4rem;
    padding: 1.2rem;
  }

  .toy-copy h3 {
    font-size: clamp(3.5rem, 18vw, 5.4rem);
  }

  .toy-preview {
    min-height: 22rem;
    padding: 1rem;
  }

  .workshop-footer {
    display: grid;
    gap: 0.8rem;
    margin-top: 2rem;
  }

  .project-ledger {
    margin-top: 4rem;
  }

  .project-row {
    grid-template-columns: 2rem minmax(0, 1fr) 1rem;
    gap: 0.65rem;
    min-height: 7rem;
    padding-right: 0;
    padding-left: 0;
  }

  .project-row:hover {
    padding-right: 0.4rem;
    padding-left: 0.4rem;
  }

  .project-stack,
  .project-status {
    display: none;
  }

  .project-main strong {
    font-size: 1.45rem;
  }

  .project-main span {
    font-size: 0.7rem;
    line-height: 1.65;
  }

  .afterglow-copy {
    margin-left: 3vw;
  }

  .afterglow-pond {
    top: 36%;
    right: -28vw;
    width: 34rem;
    height: 34rem;
    opacity: 0.68;
  }

  .garden-footer {
    right: 1.35rem;
    bottom: 1.35rem;
    left: 1.35rem;
    font-size: 0.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(html) {
    scroll-behavior: auto;
    scroll-snap-type: none;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
