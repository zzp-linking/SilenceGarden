<template>
	<div class="container">
		<div class="content">
      <input v-if="!isPc" type="text" v-model="keyword"
             placeholder="检索……"
             class="h5-keyword" @input="indistinctSearch">
      <div class="search-area" v-if="isPc">
        <mu-text-field v-model="keyword"
             label-float label="根据标题、作者、诗集、标签、内容检索……"
             @keydown.enter="indistinctSearch"
             class="keyword poetry-catalog-search"></mu-text-field>
        <mu-button class="search-btn" @click="indistinctSearch">搜索</mu-button>
      </div>
			<Row type="flex" justify="center">
				<Col v-for="item,index in catalog" class="item-block animated bounceIn"
             :style="{ animationDelay: index * (isPc ? 0.01 : 0.02) + 's' }"
             :key="index" :sm="8" :lg="6" :xs="12">
					<router-link :to="'/poem/'+item.title" class="item animated ">{{ item.title }}</router-link>
				</Col>
        <Col :sm="8" :lg="6" :xs="12"></Col>
        <Col :sm="8" :lg="6" :xs="12"></Col>
        <Col :sm="8" :lg="6" :xs="12"></Col>
			</Row>
		</div>
	</div>
</template>

<script>
  import { POETRY_SEARCH_KEYWORD_UPDATE } from '@/store/mutation-types'
  import { isPc } from '@/utils/tool'
  export default {
    data () {
      return {
      }
    },
    computed: {
      catalog () {
        return this.$store.state.poetry.catalog
      },
      keyword: {
        get () {
          return this.$store.state.poetry.keyword
        },
        set (value) {
          this.$store.commit(POETRY_SEARCH_KEYWORD_UPDATE, value)
        }
      },
      isPc () {
        return isPc()
      }
    },
    created () {
      this.indistinctSearch()
    },
    methods: {
      indistinctSearch (value) {
        console.log('propertychange', value)
        const keyword = this.keyword
        if (keyword) {
          this.$store.dispatch('getPoetryCatalogByKeyword', { keyword })
        } else {
          this.$store.dispatch('getPoetryCatalog')
        }
      }
    }
  }
</script>

<style lang="less" scoped="scoped">
@import '../../config/base.less';
  .item{
    color: #383838;
    display: inline-block;
    border-radius: 4px;
    padding: 0 10px;
    font-size: 36px;
    transition: all .5s;
    //background: linear-gradient(to top, rgba(0, 0, 0, 0.4), rgba(255, 255, 288, 0.8));
    background: linear-gradient(-90deg, rgba(0, 0, 0, 0.4), rgba(255, 255, 288, 0.8));
  }
  .item:hover{
    color: #2b85e4;
    animation-name: jello;
    transform-origin: center;
    background: linear-gradient(-90deg, rgba(0, 0, 0, 0.3), rgba(255, 255, 288, 0.4));
  }
  .item-block{
    margin-bottom: 5px;
  }
  .container{
    min-height: 100vh;
    overflow: hidden;
    background-image: url(/assets/image/common/poetry-list-bg.jpg);
    background-repeat: no-repeat;
    background-size: 100% 100%;
    font-family: @poem;
    font-size: 24px;
    background-attachment: fixed;
  }
  .title{
    font-size: 36px
  }
  .content{
    max-width: 1400px;
    margin: 50px auto;
  }

  .search-area{

  }
  .keyword{
    background: linear-gradient(-90deg,  rgba(255, 255, 288, 0.4), rgba(0, 0, 0, 0.3));
    color: firebrick;
    height: 60px;
    padding-left: 20px;
    padding-right: 20px;
    padding-bottom: 8px;
    border-radius: 4px;
    font-size: 36px;
    width: 80%;
  }
  .search-btn{
    font-size: 32px;
    vertical-align: top;
    width: 15%;
    height: 60px;
    margin-left: 4%;
    background: linear-gradient(-90deg,  rgba(255, 255, 288, 0.4), rgba(0, 0, 0, 0.3));
  }
  .h5-keyword{
    width: 90%;
    display: block;
    margin-left: auto;
    margin-right: auto;
    border-radius: 4px;
    border: none;
    background: linear-gradient(90deg,  rgba(255, 105, 180, 0.4), rgba(255, 215, 0, 0.3));
    text-indent: 1em;
    margin-bottom: 5px;
  }
::-webkit-input-placeholder { /* WebKit, Blink, Edge */
    font-family: "楷体";
    font-size: 16px;
}
@media only screen and (max-width: @threshold) {
  .content{
    margin: 5% auto;
  }
  .item{
    font-size: 20px;
    padding: 0 5px;
    margin-left: 2em;
  }
  .item-block{
    margin-bottom: 0px;
  }
}
</style>
<style>
  .poetry-catalog-search .mu-text-field-input{
    color: #d1f2e1;
    font-weight: bold;
  }

</style>

