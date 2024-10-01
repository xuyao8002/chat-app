<template>
  <div>
    <h1>Register</h1>
    <input type="text" v-model="username" placeholder="Username" />
    <input type="password" v-model="password" placeholder="Password" />
    <button @click="register">Register</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      username: '',
      password: ''
    };
  },
  methods: {
    register() {
      // Handle registration logic here
      this.$router.push('/login');
    }
  }
};
</script>
