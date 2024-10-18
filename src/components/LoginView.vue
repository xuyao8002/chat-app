<template>
  <div>
    <h1>Login</h1>
    <form @submit.prevent="login">
    <div>
       <label for="username">Username:</label>
        <input type="text" id="username" v-model="username" placeholder="Username" />
        <div v-if="usernameError" style="color: red;">{{ usernameError }}</div>
    </div>
    <div>
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" placeholder="Password" />
        <div v-if="passwordError" style="color: red;">{{ passwordError }}</div>
      </div>
      <button type="submit">Login</button>
    </form>
    <div v-if="errorMessage" style="color: red;">{{ errorMessage }}</div>
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
      usernameError: '',
      passwordError: '',
      errorMessage: ''
    };
  },
  methods: {
    async login() {
      this.usernameError = '';
      this.passwordError = '';
      if (!this.username.trim()) {
        this.usernameError = '用户名不能为空';
      }
      if (!this.password.trim()) {
        this.passwordError = '密码不能为空';
      }
      if (this.usernameError || this.passwordError) {
        return;
      }
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
form div {
  margin-bottom: 10px;
}
</style>
