<template>
  <div id="app">
  	<Global/>
    <router-view/>
  </div>
</template>

<script>
import Global from '@/components/page/Global'
export default {
  name: 'App',
  components: {
  	Global
  }
}
</script>

<style>
.clearfix:after{
	content: '';
	display: block;
	clear: both;
}
.overflow-ellipsis{
	text-overflow:ellipsis;
	overflow:hidden;
	white-space: nowrap; 
}
</style>
