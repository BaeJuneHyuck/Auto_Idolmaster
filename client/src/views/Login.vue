<template>
  <div class="login-container">
    <h2>로그인</h2>
    <input v-model="username" placeholder="사용자 이름" />
    <input v-model="password" type="password" placeholder="비밀번호" />
    <button @click="login">로그인</button>
    <button @click="register">회원가입</button>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      username: '',
      password: ''
    };
  },
  methods: {
    async login() {
      try {
        const res = await axios.post('https://probable-enigma-4g665rjrv9gh5qp7-3000.app.github.dev/login', {
          username: this.username,
          password: this.password
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', this.username);
        this.$router.push('/lobby');
      } catch (err) {
        alert('로그인 실패');
      }
    },
    async register() {
      try {
        await axios.post('https://probable-enigma-4g665rjrv9gh5qp7-3000.app.github.dev/register', {
          username: this.username,
          password: this.password
        });
        alert('회원가입 성공! 로그인 해주세요.');
      } catch (err) {
        alert('회원가입 실패');
      }
    }
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  width: 300px;
  margin: 100px auto;
  gap: 10px;
}
</style>