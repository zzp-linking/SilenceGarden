'use strict'
// 模板版本：1.3.1。
// 文档参考：http://vuejs-templates.github.io/webpack。

const path = require('path')

module.exports = {
  dev: {

    // 路径配置。
    assetsSubDirectory: 'static',
    assetsPublicPath: '/',
    proxyTable: {
    	"/api": {
	      /* 历史代码参考（不参与执行）："target": "http://47.98.129.238:4000",*/
	     "target": "http://localhost:4000",
	      "changeOrigin": true,
	    }
    },

    // 开发服务器的其他设置。
    host: '0.0.0.0', // 可由 process.env.HOST 覆盖。
    port: 8090, // 可由 process.env.PORT 覆盖；端口被占用时自动选择空闲端口。
    autoOpenBrowser: true,
    errorOverlay: true,
    notifyOnErrors: true,
    poll: false, // 文件监听配置参考：https://webpack.js.org/configuration/dev-server/#devserver-watchoptions-。


    /**
     * 源码映射配置。
     */

    // 开发映射参考：https://webpack.js.org/configuration/devtool/#development。
    devtool: 'cheap-module-eval-source-map',

    // 如果开发工具调试 Vue 文件时遇到问题，
    // 可尝试将此选项设为 false。
    // 缓存更新选项参考：https://vue-loader.vuejs.org/en/options.html#cachebusting。
    cacheBusting: true,

    cssSourceMap: true
  },

  build: {
    // index.html 页面模板。
    index: path.resolve(__dirname, '../dist/index.html'),

    // 路径配置。
    assetsRoot: path.resolve(__dirname, '../dist'),
    assetsSubDirectory: 'static',
    assetsPublicPath: '/',

    /**
     * 源码映射配置。
     */

    productionSourceMap: true,
    // 生产映射参考：https://webpack.js.org/configuration/devtool/#production。
    devtool: '#source-map',

    // 默认关闭 Gzip，因为 Surge、Netlify 等常见静态托管服务
    // 已经会自动压缩全部静态资源。
    // 设置为 true 之前，先执行下列安装命令：
    // 安装开发依赖：npm install --save-dev compression-webpack-plugin。
    productionGzip: false,
    productionGzipExtensions: ['js', 'css'],

    // 构建时添加额外参数，
    // 可在构建结束后查看打包分析报告：
    // 执行命令：npm run build --report。
    // 设为 true 或 false，可固定开启或关闭此功能。
    bundleAnalyzerReport: process.env.npm_config_report
  }
}
