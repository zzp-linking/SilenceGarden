import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
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
      '/api': {
        target: 'http://localhost:4000', // 请根据实际后端地址修改
        changeOrigin: true,
      }
    }
  },
  build: {
    assetsDir: 'static', // 将打包后的 JS/CSS/图片等资源放入 static 目录，避免与 Nginx 的 assets 冲突
  }
})

