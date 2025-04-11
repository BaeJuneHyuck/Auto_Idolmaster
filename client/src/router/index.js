import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Lobby from '../views/Lobby.vue';
import GameRoom from '../views/GameRoom.vue';

const routes = [
  { path: '/', name: 'Login', component: Login },
  { path: '/lobby', name: 'Lobby', component: Lobby },
  { path: '/game/:roomId', name: 'GameRoom', component: GameRoom }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;