// 配置加载器参考：https://github.com/michael-ciniawsky/postcss-load-config。

module.exports = {
  "plugins": {
    "postcss-import": {},
    "postcss-url": {},
    // 修改目标浏览器时，使用 package.json 的 browserslist 字段。
    "autoprefixer": {}
  }
}
