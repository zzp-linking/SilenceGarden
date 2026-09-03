import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

function copyIndexToDistRoot(): Plugin {
  return {
    name: 'copy-index-to-dist-root',
    closeBundle() {
      const source = path.resolve(projectRoot, 'dist/home/index.html')
      const destination = path.resolve(projectRoot, 'dist/index.html')
      if (fs.existsSync(source)) fs.copyFileSync(source, destination)
    }
  }
}

export default defineConfig({
  base: '/home/',
  plugins: [vue(), copyIndexToDistRoot()],
  resolve: {
    alias: { '@': path.resolve(projectRoot, './src') },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      less: { javascriptEnabled: true }
    }
  },
  server: {
    proxy: {
      '/home/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: requestPath => requestPath.replace(/^\/home/, '')
      },
      '/home/assets': {
        target: 'https://silencegarden.com',
        changeOrigin: true,
        rewrite: requestPath => requestPath.replace(/^\/home/, '')
      }
    }
  },
  build: {
    outDir: 'dist/home',
    assetsDir: 'static',
    emptyOutDir: true
  }
})
