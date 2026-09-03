import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

// 产物放到 dist/home/，与线上 URL /home/ 对齐，避免 nginx 把 JS 回退成 index.html
function copyIndexToDistRoot() {
  return {
    name: 'copy-index-to-dist-root',
    closeBundle() {
      const src = path.resolve(__dirname, 'dist/home/index.html')
      const dest = path.resolve(__dirname, 'dist/index.html')
      if (fs.existsSync(src)) fs.copyFileSync(src, dest)
    }
  }
}

export default defineConfig({
  base: '/home/',
  plugins: [vue(), copyIndexToDistRoot()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  server: {
    proxy: {
      '/home/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/home/, ''),
      },
      '/home/assets': {
        target: 'https://silencegarden.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/home/, ''),
      },
    }
  },
  build: {
    outDir: 'dist/home',
    assetsDir: 'static',
    emptyOutDir: true,
  }
})
