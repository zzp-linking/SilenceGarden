<template>
  <div class="login-wrap">
    <div class="form-box" @keydown.enter="handleSubmit">
      <div class="form-title">
        <h1 class="title-text">登录</h1>
      </div>
      <a-form ref="formRef" :model="form" :rules="rules" class="silencegarden-login-form">
        <a-form-item name="account">
          <a-input v-model:value="form.account" size="large" placeholder="账号">
            <template #prefix><user-outlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="password">
          <a-input-password v-model:value="form.password" size="large" placeholder="密码">
            <template #prefix><lock-outlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" class="login-btn" @click="handleSubmit">登录</a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api/auth'
import router from '@/router'
import { useRoute } from 'vue-router'
import type { FormInstance } from 'ant-design-vue'
import type { LoginRequest } from '@/types/auth'
import { safeReturnPath } from '@/features/auth/navigation'

const userStore = useUserStore()
const route = useRoute()
const formRef = ref<FormInstance>()

const form = reactive<LoginRequest>({
  account: '',
  password: ''
})

const rules = {
  account: [{ required: true, message: '账号不能为空！', trigger: 'blur' }],
  password: [
    { required: true, message: '密码不能为空', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ]
}

/** 登录成功后返回退出前的站内页面；普通路由守卫仍使用 redirect。 */
const handleSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate()
    const res = await authApi.login({
      account: form.account.trim(),
      password: form.password
    })
    if (res.user) {
      const previousUserId = userStore.user?.id
      userStore.setSession(res)
      const destination = safeReturnPath(router, route.query.backUrl)
        ?? safeReturnPath(router, route.query.redirect)
        ?? '/'
      if (previousUserId && previousUserId !== res.user.id) {
        // 直接在登录页从 A 切换到 B 时，也重建页面以清除 A 的全部内存缓存。
        window.location.replace(router.resolve(destination).href)
      } else {
        void router.replace(destination)
      }
    }
  } catch (error) {
    console.error('Login failed:', error)
  }
}
</script>

<style scoped lang="less">
@import '@/config/base.less';

.login-wrap {
  width: 100vw;
  height: 100vh;
  background: url(/home/assets/image/common/login-bg.jpg) center no-repeat;
  background-size: cover;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-box {
  width: 340px;
  padding: 30px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}

.title-text {
  text-align: center;
  color: #000;
  font-family: "楷体", serif;
  font-size: 28px;
  margin-bottom: 30px;
}

.login-btn {
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  height: 40px;
  font-size: 16px;
  
  &:hover {
    background: rgba(0, 0, 0, 0.6);
  }
}

:deep(.ant-input-affix-wrapper) {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.3);
  
  input {
    background-color: transparent !important;
    color: #000;
    
    &::placeholder {
      color: #666;
    }
  }
  
  .anticon {
    color: #333;
  }
}
</style>

