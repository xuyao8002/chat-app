<template>
  <div id="register-container">
    <h1>注册</h1>
    <form @submit.prevent="register">
      <div class="form-group">
        <input type="text" id="username" v-model="username" placeholder="用户名" required>
      </div>
      <div class="form-group">
        <input type="password" id="password" v-model="password" placeholder="密码" required>
      </div>
      <button type="submit" :disabled="!username.trim() || !password.trim()" :class="username.trim() && password.trim() ? 'register-button' : 'register-button-disabled'">注册</button>
    </form>
    <div v-if="errorMessage" style="color: red;">{{ errorMessage }}</div>
  </div>
</template>

<script>
import axios from 'axios';
export default {
  data() {
    return {
      username: '',
      password: '',
      errorMessage: ''
    };
  },
  methods: {
    async register() {
      try {
        const response = await axios.post('/api/user/register', {
          userName: this.username,
          userPwd: this.password
        });

        if (response.data.code === 1) {
          this.$router.push('/login');
        } else {
          this.errorMessage = response.data.message;
        }
      } catch (error) {
        console.error(error);
        this.errorMessage = 'An error occurred while trying to register.';
      }
      
    }
  }
};
</script>
<style scoped>
.register-button {
  padding: 10px;
  background-color: #007BFF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100px;
}
.register-button-disabled {
  padding: 10px;
  background-color: #cccccc;
  color: #777777;
  border: none;
  border-radius: 4px;
  cursor: not-allowed;
  width: 100px;
}
#register-container {
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