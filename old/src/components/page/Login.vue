<template>
	<div class="login-wrap">
		<div class="form-box" @keydown.enter="handleSubmit('form')">
			<div class="form-title">
				<!--<img src="/assets/image/common/login-bg.jpg"/>-->
				<h1 class="title-text">登录</h1>
			</div>
			<Form ref="form" :model="form" :rules="rules" class="silencegarden-login-form" >
        <FormItem prop="account">
            <Input type="text" size="large" v-model="form.account" placeholder="账号">
                <Icon type="ios-person-outline" slot="prepend"></Icon>
            </Input>
        </FormItem>
        <FormItem prop="password">
            <Input type="password" size="large" v-model="form.password" placeholder="密码">
                <Icon type="ios-lock-outline" slot="prepend"></Icon>
            </Input>
        </FormItem>
        <!--<Form-item  class="rela-plant" prop="image_code">
            <Input type="text" size="large" placeholder="请输入图形验证码" v-model="form.image_code">
              <Icon type="ios-card" slot="prepend" ></Icon>
            </Input>
            <img class="imgVali" :src="imgCodeSrc" @click="imgRefresh" alt="点击更新" title="点击更新" />
        </Form-item>-->
        <FormItem>
          <mu-button class="login-btn" @click="handleSubmit('form')">登录</mu-button>
        </FormItem>
		    </Form>
		</div>
	</div>
</template>

<script>
export default {
  data () {
    return {
      //imgCodeSrc: BASE + '/verifyCode?t=' + new Date()*1,
      form: {
        account: '',
        password: '',
        // image_code: ''
      },
      rules: {
        account: [
          { required: true, message: '账号不能为空！', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '密码不能为空', trigger: 'blur' },
          { type: 'string', min: 6, message: '密码至少6位', trigger: 'blur' }
        ],
        /*image_code: [
            { required: true, message: '图片验证码不能为空', trigger: 'blur' }
        ],*/
      }
    }
  },
  methods: {
    handleSubmit(name) {
      this.$refs[name].validate((valid) => {
        if (valid) {
        this.$store.dispatch('login', {
          account: this.form.account.trim(),
          password: this.form.password.trim(),
          //image_code: this.form.image_code.trim(),
        })
          }
      })
    },
    /*imgRefresh () {
      this.imgCodeSrc = BASE + '/verifyCode?t=' + new Date()*1
    }*/
  }
}
</script>

<style scoped="scoped">
	.rela-plant{
	position: relative;
	}
	.regist-btn{
		width: 100%;
		height: 44px;
	}
	.login-btn{
		width: 100%;
    background: rgba(0, 0, 0, 0.3);
    color: #fff;
	}
	.form-box{
		width: 300px;
		height: 300px;
		display: block;
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
    padding: 0 20px;
    border-radius: 4px;
		margin: auto;
    background-color: rgba(255, 255, 255, 0.2);

	}
	.form-title{
	}
	.title-text{
		display: inline-block;
		vertical-align: text-bottom;
		color: #000;
		font-family: "楷体";
		font-size: 26px;
	}
	.login-wrap{
		width: 100vw;
		height: 100vh;
		background: url(/assets/image/common/login-bg.jpg) center  no-repeat;
		background-size: cover;
	}
	.imgVali{
		height: 34px;
		position: absolute;
		top: 2px;
		right: 1px;
		z-index: 10;
		cursor: pointer;
		border-top-right-radius: 4px;
		border-bottom-right-radius: 4px;
	}
</style>
<style>
  .silencegarden-login-form input,.silencegarden-login-form .ivu-input-group-prepend{
    background-color: rgba(0, 0, 0, 0.2) !important;
    color: #ffffff;
  }

</style>
