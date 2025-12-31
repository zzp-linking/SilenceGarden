<template>
  <div class="article-catalog">
    <div class="container">
      <div v-for="item,index in catalog" :key="item.title" class="catalog-item">
        <router-link class="link" :to=" '/article/' + item._id"> {{ index + 1 + '、' }}{{ item.title }}</router-link>
        <span v-for="el,index in item.tags" :key="index" class="tag">{{ el }}</span>
      </div>
    </div>

  </div>
</template>

<script>
    export default {
      name: "ArticleCatalog",
      data () {
        return {

        }
      },
      computed: {
          catalog () {
            return this.$store.state.article.catalog
          }
      },
      created () {
        this.$store.dispatch('getArticleCatalog')
      }
    }
</script>

<style scoped lang="less">
  @import "../../config/base.less";
  .catalog-item{
    font-size: 16px;
    margin-bottom: 10px;
  }
  .article-catalog{
    min-height: 100vh;
    background-image: url(/assets/image/article/read-bg.jpg);
    background-attachment: fixed;
  }
  .container{
    max-width: 1100px;
    min-height: 100vh;
    padding: 50px;
    margin: 0 auto;
    border-left: 10px solid rgba(255, 255, 255, 0.2);
    border-right: 10px solid rgba(255, 255, 255, 0.2);
  }
  .link{
    color: #000000;
    margin-right: 10px;
  }
  .link:hover{
    color: #57a3f3;
  }
  .tag{
    background-color: #19be6b;
    border-radius: 4px;
    font-size: 12px;
    padding: 2px 5px;
    margin: 0 2px;
    color: #ffffff;
    vertical-align: text-top;
  }
  @media only screen and (max-width: @threshold) {
    .container{
      padding: 50px 2%;
      border: none;
    }
  }
</style>
