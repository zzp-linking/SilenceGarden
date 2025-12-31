<template>
	<div class="violin-catalog-cintainer">
		<div class="content">
			<Row :gutter="6" type="flex" justify="space-around" class="link-group">
				<Col :lg="6" :md="10" :sm="11" :xs="20"
					 class="animated fadeInUp link-item"
					 :style="{ animationDelay: index * 0.3 + 's' }"
					 v-for="item,index in catalog" :key="index + 'box'">
					<LinkBox :violin="item"/>
				</Col>
				<Col :lg="6" :md="10" :sm="11" :xs="20" >
				</Col>
				<Col :lg="6" :md="10" :sm="11" :xs="20" >
				</Col>
				<Col :lg="6" :md="10" :sm="11" :xs="20" >
				</Col>
			</Row>
		</div>
	</div>
</template>

<script>
	import LinkBox from '@/components/pure/violin_catalog/LinkBox'

	export default {
		created () {
			this.$store.dispatch('getVillinCatalog')
		},
		computed: {
			catalog () {
				return this.$store.state.violin.catalog
			}
		},
		components: {
			LinkBox
		}
	}
</script>

<style scoped="scoped" lang="less">/*violin-catalog-bg.jpg*/
@import '../../config/base.less';
.content{
	width: 100%;
	max-width: 1400px;
	margin: 0 auto;
}
.violin-catalog-cintainer{
	min-height: 100vh;
	background-image: url("@{image}/violin/violin-catalog-bg.jpg");
	background-position: center;
	background-attachment: fixed;
	overflow: hidden;
}
.link-group{
	margin-top: 160px;
}
.link-item{
	margin-bottom: 20px;
}
@media only screen and (max-width: @threshold) {
	.link-group{
		margin-top: 4vh;
	}
	.link-item{
		margin-bottom: 10px;
	}
}
</style>
