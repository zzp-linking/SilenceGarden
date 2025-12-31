<template>
  <div class="loading-overlay" :class="{ 'loading-on': loading }">
    <div class="loader-container">
      <div class="loader loader4">
        <div><div><div><div><div><div><div><div><div><div></div></div></div></div></div></div></div></div></div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped lang="less">
@import "@/config/base.less";

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  
  &.loading-on {
    opacity: 1;
    pointer-events: auto;
  }
}

.loader-container {
  width: 150px;
  height: 150px;
  position: relative;
}

.loader, .loader div {
  border-radius: 50%;
  padding: 4px;
  border: 2px solid transparent;
  animation: rotate2 4s infinite linear;
  height: 100%;
}

div:hover {
  animation-play-state: paused;
}

.loader, .loader * {
  will-change: transform;
}

@keyframes rotate2 {
  0% {
    transform: rotate(0deg);
    border-top-color: rgba(0, 0, 0, 0.5);
  }
  50% {
    transform: rotate(180deg);
    border-top-color: rgba(255, 69, 0, 0.5);
  }
  100% {
    transform: rotate(360deg);
    border-top-color: rgba(0, 0, 0, 0.5);
  }
}

@media only screen and (max-width: @threshold) {
  .loader, .loader div {
    border: 1px solid transparent;
    padding: 2px;
  }
  .loader-container {
    width: 100px;
    height: 100px;
  }
}
</style>

