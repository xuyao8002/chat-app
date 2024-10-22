<template>
  <div id="login-container">
    <h1>登录</h1>
    <form @submit.prevent="login">
      <div class="form-group">
        <input type="text" id="username" v-model="username" placeholder="用户名" required>
      </div>
      <div class="form-group">
        <input type="password" id="password" v-model="password" placeholder="密码" required>
      </div>
      <button type="submit" :disabled="!username.trim() || !password.trim()" :class="username.trim() && password.trim() ? 'login-button' : 'login-button-disabled'">登录</button>
    </form>
    <div v-if="errorMessage" style="color: red;">{{ errorMessage }}</div>
    <div><a href="/register">注册</a></div>
  </div>
</template>

<script>
import axios from 'axios';
import Cookies from 'js-cookie';
export default {
  data() {
    return {
      username: '',
      password: '',
      errorMessage: ''
    };
  },
  methods: {
    async login() {
      
      try {
        const response = await axios.post('/api/user/login', {
          userName: this.username,
          userPwd: this.password
        });

        if (response.data.code === 1) {
          // 登录成功
          // document.cookie = `token=${encodeURIComponent(response.data.data)}; path=/`;
          Cookies.set('token', response.data.data.token);
          Cookies.set('userId', response.data.data.userId);
          Cookies.set('userName', response.data.data.userName);
          this.$router.push('/chat');
        } else {
          this.errorMessage = response.data.message;
        }
      } catch (error) {
        console.error(error);
        this.errorMessage = 'An error occurred while trying to login.';
      }
    }
  }
};
</script>
<style scoped>
.login-button {
  padding: 10px;
  background-color: #007BFF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100px;
}
.login-button-disabled {
  padding: 10px;
  background-color: #cccccc;
  color: #777777;
  border: none;
  border-radius: 4px;
  cursor: not-allowed;
  width: 100px;
}
#login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 10px;
}

.form-group input {
  order: 2;
  width: 100%;
  padding: 5px;
  box-sizing: border-box;
}
</style>