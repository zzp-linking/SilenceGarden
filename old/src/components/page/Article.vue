<template>
  <div>
    <div class="article-wrap" :class="{ 'forbidden-scroll': modal_img_open }">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/github.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/2.9.0/github-markdown.min.css">
      <div class="article-container">
        <h2 class="title">{{ article.title }}</h2>
        <div class="tags">
          <Tag color="DarkOrange" v-for="item in article.tags" :key="item">{{item}}</Tag>
        </div>
        <div class="time">{{ article.time }}</div>
        <div class="article-content-s markdown-body"  @click="contentClick" v-html="html"></div>
      </div>
    </div>
    <div class="img-modal" :class="{ open: modal_img_open }" @click="modal_img_open = false">
      <img class="modal-image" :src="modal_img" alt="">
    </div>
    <Loading :loading="loading"/>
  </div>
</template>

<script>
  import Loading from '@/components/pure/common/Loading'
  import { isPc } from "../../utils/tool";

  export default {
    name: "Article",
    data () {
      return {
        modal_img_open: false,
        modal_img: ''
      }
    },
    computed: {
      html () {
        const html = this.$store.state.article.article.html
        return html ? html : ''
      },
      article () {
        return this.$store.state.article.article
      },
      loading () {
        return this.$store.state.article.get_article_loading
      }
    },
    created () {
      const id = this.$route.params.id
      this.$store.dispatch('getArticleDetails', { id })
    },
    methods: {
      contentClick (e) {
        const nodeName = e.target.nodeName
        if (isPc() && nodeName === 'IMG') {
          this.modal_img = e.target.getAttribute('src')
          this.modal_img_open = true
        }
      }
    },
    components: {
      Loading,
    }
  }
</script>

<style scoped lang="less">
  @import '../../config/base.less';
  .img-modal.open{
   // height: 100vh;
    display: block;
  }
  .img-modal{
    display: none;
    text-align: center;
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 1000;
    background-color: #ffffff;
    height: 100vh;
    line-height: 100vh;
    overflow: auto;
  }
  .open .modal-image{
    animation: showImage .3s cubic-bezier(0,-.5,.2,1.4);
  }
  .modal-image{
    vertical-align: middle;
  }
  .title{
    text-align: center;
    letter-spacing: .05em;
  }
  .markdown-body{
    font-size: 14px;
  }
  .article-wrap{
    height: 100vh;
    background-image: url(/assets/image/article/read-bg.jpg);
    background-attachment: fixed;
    overflow: auto;
  }
  .article-container{
    max-width: 1100px;
    min-height: 100vh;
    padding: 50px;
    margin: 0 auto;
    border-left: 10px solid rgba(255, 255, 255, 0.2);
    border-right: 10px solid rgba(255, 255, 255, 0.2);
  }
  .tags{
    text-align: center;
    margin-top: 20px;
    padding: 0 20%;
  }
  .article-content-s{
    margin-top: 20px;
  }
  .time{
    text-align: right;
  }
  .forbidden-scroll{
    overflow: hidden;
  }
  @keyframes showImage {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @media only screen and (max-width: @threshold) {
    .article-container{
      padding: 50px 1%;
      border: none;
    }
  }
</style>
<style>
  .article-content-s img{
    max-width: 100%;
    cursor: pointer;
  }
  .markdown-body code {
    font-size: 100% !important;
  }
</style>
