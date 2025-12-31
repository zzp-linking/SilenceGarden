<template>

  <Loading :loading="loading"/>

</template>

<script>
	import { Message, Notice, Modal, LoadingBar } from 'iview';
  import  Loading from '@/components/pure/common/Loading'
	export default {
		data () {
			return {
			}
		},
		computed: {
      loading () {
        return this.$store.state.loading
      },
			token () {
				return this.$store.state.token
			},
			notice () {
				return this.$store.state.notice.state
			},
			noticeClose () {
				return this.$store.state.noticeClose.state
			},
			message () {
				return this.$store.state.message.state
			},
			simpleModal () {
				return this.$store.state.simpleModal.state
			},
			confirmMoadl () {
				return this.$store.state.confirmMoadl.state
			},
			progress () {
				return this.$store.state.progress
			}
		},
		mounted () {
			Message.config({
			    top: 50
			});
		},
		watch: {
			token: function () {
				localStorage.setItem('token',this.$store.state.token)
				localStorage.setItem('user',JSON.stringify(this.$store.state.user))
			},
			notice: function () {
				let config = this.$store.state.notice.config;
				let type = this.$store.state.notice.type;
				switch (type){
					case 1:
						Notice.info(config)
						break;
					case 2:
						Notice.success(config)
						break;
					case 3:
						Notice.warning(config)
						break;
					case 4:
						Notice.error(config)
						break;
					default:
						Notice.open(config)
						break;
				}
			},
			noticeClose: function () {
				let key = this.$store.state.noticeClose.key;
				this.$Notice.destroy();
			},
			message: function () {
				let type = this.$store.state.message.type;
				let config = this.$store.state.message.config;
				switch (type){
					case 1:
						Message.loading(config)
						break;
					case 2:
						Message.success(config)
						break;
					case 3:
						Message.warning(config)
						break;
					case 4:
						Message.error(config)
						break;
					default:
						Message.info(config)
						break;
				}
			},
			simpleModal: function () {
				let type = this.$store.state.simpleModal.type;
				let config = this.$store.state.simpleModal.config;
				switch (type){
					case 1:
						Modal.info(config)
						break;
					case 2:
						Modal.success(config)
						break;
					case 3:
						Modal.warning(config)
						break;
					case 4:
						Modal.error(config)
						break;
					default:
						Modal.info(config)
						break;
				}
			},
			confirmMoadl: function () {
				let config = this.$store.state.confirmMoadl.config;
				this.$Modal.confirm(config);
			},
			progress: function() {
				if (this.progress) {
					LoadingBar.start();
				} else {
					 LoadingBar.finish();
				}
			}
		},
    components: {
      Loading,
    }
	}
</script>

<style>
</style>
