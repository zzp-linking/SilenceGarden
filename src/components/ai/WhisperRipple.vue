<script setup lang="ts">
/**
 * 静语涟漪 —— 产品设计文档 §9.4 定义的品牌签名元素。
 * 蓝→紫两层细环缓慢扩散；reduced-motion 下退化为静态双环。
 */
withDefaults(defineProps<{ size?: number; animated?: boolean }>(), { size: 40, animated: true })
</script>

<template>
  <span
    class="whisper-ripple"
    :class="{ animated, hollow: $slots.default }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <span class="ring ring-a"></span>
    <span class="ring ring-b"></span>
    <span class="core"><slot /></span>
  </span>
</template>

<style scoped>
.whisper-ripple {
  position: relative;
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
}
.ring {
  position: absolute;
  inset: 0;
  border: 1.5px solid;
  border-radius: 50%;
  opacity: 0;
}
.ring-a {
  border-color: var(--whisper-blue);
}
.ring-b {
  border-color: var(--whisper-violet);
}
.core {
  position: relative;
  display: grid;
  width: 46%;
  height: 46%;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--whisper-blue), var(--whisper-violet));
  color: #fff;
}
.hollow .core {
  width: 58%;
  height: 58%;
}
.animated .ring-a {
  animation: whisper-ripple 2.6s var(--whisper-ease) infinite;
}
.animated .ring-b {
  animation: whisper-ripple 2.6s var(--whisper-ease) 1.3s infinite;
}
@keyframes whisper-ripple {
  0% { opacity: 0.85; transform: scale(0.5); }
  65% { opacity: 0.28; }
  100% { opacity: 0; transform: scale(1.4); }
}
@media (prefers-reduced-motion: reduce) {
  .animated .ring {
    animation: none;
    opacity: 0.4;
    transform: scale(0.85);
  }
}
</style>
