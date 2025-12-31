<template>
	<router-link :to="'/violin/' + violin._id" class="link-box-container">
		<div class="box clearfix">
			<div class="box-image">
				<img class="disk-img" :src="srcJoin(violin.disk_img)"/>
			</div>
			<div class="box-info">
				<div>
					<div class="title overflow-ellipsis" :title="violin.name">{{ violin.name }}</div>
				</div>
				<div class="album">{{ violin.album }}</div>
				<div class="tags">
					<span v-for="item in violin.tag" class="violin-tag" :key="item">{{ item }}</span>
				</div>
			</div>
		</div>
		
	</router-link >
</template>

<script>
	import { IMG } from '@/config/url'
	export default {
		props: ['violin'],
		methods: {
			srcJoin (src) {
				return `${IMG}/violin/${src}`
			}
		}
	}
</script>

<style lang="less" scoped="scoped">
@import '../../../config/base.less';

.link-box-container{
	display: block;
}
.box{
	line-height: 1;
	background-color: rgba(105, 105, 105, 0.6);
	border-radius: 4px;
	padding: 5px 10px;
}
.box-image{
	display: inline-block;
	margin-left: 10px;
	width: 90px;
	height: 90px;
	background-image: url('/assets/image/violin/catalog-disk-bg.png');
	background-size: 170% 170%;
	background-position: center;
	overflow: hidden;
	animation: diskrotate 6s linear infinite;
	animation-play-state: paused;
}
.disk-img{
	margin-left: -35%;
	margin-top: -35%;
	width: 170%;
	height: 170%;
	user-select:none;
}
.box-info{
	display: inline-block;
	min-height: 90px;
	vertical-align: top;
	margin-left: 15px;
	width: calc(100% - 120px);
}
.title{
	color: #FFFFFF;
	font-size: 24px;
	margin-top: 10px;
	word-spacing: .1em;
	font-family: @poem;
}
.album{
	color: pink;
	margin-top: 10px;
	display: inline-block;
	padding: 2px 5px;
	border-radius: 4px;
	transition: all .3s;
	font-style: italic;
}
.album:hover{
	background-color: pink;
	color: #FFFFFF;
}
.tags{
	margin-top: 10px;
	margin-bottom: 5px;
}
.violin-tag{
	color: #D5E8FC;
	display: inline-block;
	border: 1px solid #D5E8FC;
	border-radius: 4px;
	padding: 1px 3px;
	margin-right: .5em;	
	margin-bottom: 4px;
  transition: all .5s;
}
.violin-tag:hover{
  background-color: #D5E8FC;
  color: green;
}
.link-box-container:hover .box-image{
	animation-play-state: running;
}

@keyframes diskrotate{
	from{
		transform: rotate(0deg);
	}
	to{
		transform: rotate(360deg);
	}
}

@keyframes heartbeat {
	0% {
		transform: scale(0.9, 0.9);
		opacity:1;
	}
	25% {
		transform: scale(1.1, 1.1);
		opacity:0.8;
	}
	100% {
		transform: scale(0.9, 0.9);
		opacity:1;
	}
}
@media only screen and (max-width: @threshold) {
  .box-image{
    width: 70px;
    height: 70px;
  }
  .box-info{
    min-height: 70px;
  }
  .title{
    margin-top: 6px;
    font-size: 18px;
  }
  .album{
    font-size: 12px;
    margin-top: 4px;
  }
  .violin-tag{
    font-size: 12px;
  }
  .tags{
    margin-top: 4px;
    margin-bottom: 1px;
  }
}
</style>
