<template>
  <div class="lobby-container">
    <h2>게임방 목록</h2>
    <div v-for="room in rooms" :key="room._id" @click="showRoomPopup(room)" class="room-item">
      <span>{{ room.name }}</span>
      <span>{{ room.status }}</span>
      <span>{{ room.players.length }}/{{ room.maxPlayers }}</span>
    </div>
    <button @click="createRoom">게임방 생성</button>

    <div v-if="selectedRoom" class="popup">
      <div class="popup-content">
        <h3>{{ selectedRoom.name }}</h3>
        <p>상태: {{ selectedRoom.status }}</p>
        <p>인원: {{ selectedRoom.players.length }}/{{ selectedRoom.maxPlayers }}</p>
        <button @click="joinRoom">참여</button>
        <button @click="selectedRoom = null">닫기</button>
      </div>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client';

export default {
  data() {
    return {
      socket: null,
      rooms: [],
      selectedRoom: null,
      username: localStorage.getItem('username')
    };
  },
  created() {
    this.socket = io('http://localhost:3000', {
      auth: { token: localStorage.getItem('token') }
    });
    this.setupSocketListeners();
  },
  methods: {
    setupSocketListeners() {
      this.socket.on('connect', () => {
        this.socket.emit('init', this.username);
      });
      this.socket.on('initData', ({ rooms, username }) => {
        this.rooms = rooms;
        this.username = username;
      });
      this.socket.on('roomList', (rooms) => {
        this.rooms = rooms;
      });
      this.socket.on('joinedRoom', ({ room }) => {
        this.$router.push(`/game/${room._id}`);
      });
    },
    createRoom() {
      this.socket.emit('createRoom', `방${Date.now()}`, this.username);
    },
    joinRoom() {
      this.socket.emit('joinRoom', this.selectedRoom._id, this.username);
      this.selectedRoom = null;
    },
    showRoomPopup(room) {
      this.selectedRoom = room;
    }
  },
  beforeDestroy() {
    this.socket.disconnect();
  }
};
</script>

<style scoped>
.lobby-container {
  padding: 20px;
}
.room-item {
  cursor: pointer;
  padding: 10px;
  border-bottom: 1px solid #ccc;
}
.popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.popup-content {
  background: white;
  padding: 20px;
  border-radius: 5px;
}
</style>