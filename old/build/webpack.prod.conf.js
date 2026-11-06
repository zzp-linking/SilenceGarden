'use strict'
const path = require('path')
const utils = require('./utils')
const webpack = require('webpack')
const config = require('../config')
const merge = require('webpack-merge')
const baseWebpackConfig = require('./webpack.base.conf')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

const env = require('../config/prod.env')

const webpackConfig = merge(baseWebpackConfig, {
  module: {
    rules: utils.styleLoaders({
      sourceMap: config.build.productionSourceMap,
      extract: true,
      usePostCSS: true
    })
  },
  devtool: config.build.productionSourceMap ? config.build.devtool : false,
  output: {
    path: config.build.assetsRoot,
    filename: utils.assetsPath('js/[name].[chunkhash].js'),
    chunkFilename: utils.assetsPath('js/[id].[chunkhash].js')
  },
  plugins: [
    // 生产构建参考：http://vuejs.github.io/vue-loader/en/workflow/production.html。
    new webpack.DefinePlugin({
      'process.env': env
    }),
    new UglifyJsPlugin({
      uglifyOptions: {
        compress: {
          warnings: false
        }
      },
      sourceMap: config.build.productionSourceMap,
      parallel: true
    }),
    // 将 CSS 提取到独立文件。
    new ExtractTextPlugin({
      filename: utils.assetsPath('css/[name].[contenthash].css'),
      // 下列选项设为 false 时，不会从代码分块中提取 CSS；
      // webpack 加载分块后，会改由 style-loader 动态插入对应样式。
      // 当前设为 true，因为设为 false 时源码映射也会进入代码分块，
      // 增大文件体积；相关问题：https://github.com/vuejs-templates/webpack/issues/1110。
      allChunks: true,
    }),
    // 压缩已提取的 CSS；使用此插件同时去重
    // 不同组件中可能重复的样式。
    new OptimizeCSSPlugin({
      cssProcessorOptions: config.build.productionSourceMap
        ? { safe: true, map: { inline: false } }
        : { safe: true }
    }),
    // 生成构建目录的 index.html，写入正确资源摘要以支持缓存。
    // 可以编辑 /index.html 自定义页面输出。
    // 插件参考：https://github.com/ampedandwired/html-webpack-plugin。
    new HtmlWebpackPlugin({
      filename: config.build.index,
      template: 'index.html',
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
        // 更多选项参考：
        // HTML 压缩参数：https://github.com/kangax/html-minifier#options-quick-reference。
      },
      // 使用 CommonsChunkPlugin 时，保证多个分块处理一致所需的配置。
      chunksSortMode: 'dependency'
    }),
    // 供应商依赖不变时保持 module.id 稳定。
    new webpack.HashedModuleIdsPlugin(),
    // 开启作用域提升。
    new webpack.optimize.ModuleConcatenationPlugin(),
    // 将供应商 JavaScript 依赖拆分到独立文件。
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks (module) {
        // node_modules 中被引用的模块均提取到供应商依赖分块。
        return (
          module.resource &&
          /\.js$/.test(module.resource) &&
          module.resource.indexOf(
            path.join(__dirname, '../node_modules')
          ) === 0
        )
      }
    }),
    // 将 webpack 运行时和模块清单提取到独立文件，
    // 避免应用业务包更新时连带改变供应商依赖摘要。
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      minChunks: Infinity
    }),
    // 此实例提取代码拆分后各分块共用的内容，
    // 将其打包为类似供应商依赖的独立分块。
    // 异步共用分块参考：https://webpack.js.org/plugins/commons-chunk-plugin/#extra-async-commons-chunk。
    new webpack.optimize.CommonsChunkPlugin({
      name: 'app',
      async: 'vendor-async',
      children: true,
      minChunks: 3
    }),

    // 复制自定义静态资源。
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, '../static'),
        to: config.build.assetsSubDirectory,
        ignore: ['.*']
      }
    ])
  ]
})

if (config.build.productionGzip) {
  const CompressionWebpackPlugin = require('compression-webpack-plugin')

  webpackConfig.plugins.push(
    new CompressionWebpackPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: new RegExp(
        '\\.(' +
        config.build.productionGzipExtensions.join('|') +
        ')$'
      ),
      threshold: 10240,
      minRatio: 0.8
    })
  )
}

if (config.build.bundleAnalyzerReport) {
  const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
  webpackConfig.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = webpackConfig
