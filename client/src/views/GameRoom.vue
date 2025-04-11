<template>
  <div class="game-screen">
    <h3>{{ currentRoom.name }}</h3>
    <p>HP: {{ myState.hp }} | 돈: {{ myState.money }}</p>
    <button v-if="currentRoom.creator === username && !gameState" @click="startGame">게임 시작</button>
    <button @click="leaveRoom">나가기</button>

    <div class="game-area" v-if="gameState">
      <div class="player-board">
        <h4>내 격자</h4>
        <div class="grid">
          <div v-for="i in 9" :key="i" @click="placeCard(i)" :class="{ occupied: board[i-1] }">
            {{ board[i-1] ? board[i-1].cardId : '' }}
          </div>
        </div>
      </div>
      <div class="enemy-board">
        <h4>전투 영역</h4>
      </div>
      <div class="shop" v-if="gameState.phase === 'prepare'">
        <button @click="buyCard('warrior')">전사 (100)</button>
        <button @click="buyCard('archer')">궁수 (100)</button>
        <button @click="ready">준비 완료</button>
      </div>
    </div>

    <div class="chat-container" v-if="!gameState || gameState.phase === 'prepare'">
      <div class="chat-messages">
        <div v-for="msg in messages" :key="msg.timestamp">
          {{ msg.user }}: {{ msg.text }}
        </div>
      </div>
      <div class="chat-input">
        <input v-model="chatMessage" @keyup.enter="sendMessage" />
        <button @click="sendMessage">전송</button>
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
      socketId: null,
      currentRoom: null,
      messages: [],
      chatMessage: '',
      username: localStorage.getItem('username'),
      gameState: null,
      myState: { hp: 100, money: 1000, cards: [] }
    };
  },
  computed: {
    board() {
      return this.gameState?.boards[this.socketId] || [];
    }
  },
  created() {
    this.socket = io('https://probable-enigma-4g665rjrv9gh5qp7-3000.app.github.dev', {
      auth: { token: localStorage.getItem('token') }
    });
    this.setupSocketListeners();
    this.joinCurrentRoom();
  },
  methods: {
    setupSocketListeners() {
      this.socket.on('connect', () => {
        this.socketId = this.socket.id;
      });
      this.socket.on('joinedRoom', ({ room }) => {
        this.currentRoom = room;
        this.myState = room.playerStates.find(ps => ps.socketId === this.socketId);
      });
      this.socket.on('chatMessage', (msg) => {
        if (this.currentRoom && msg.roomId === this.currentRoom._id.toString()) {
          this.messages.push(msg);
        }
      });
      this.socket.on('leftRoom', () => {
        this.$router.push('/lobby');
      });
      this.socket.on('gameStarted', ({ room, gameState }) => {
        this.gameState = gameState;
        this.currentRoom = room;
      });
      this.socket.on('gameUpdate', (gameState) => {
        this.gameState = gameState;
      });
      this.socket.on('playerUpdate', (playerStates) => {
        this.myState = playerStates.find(ps => ps.socketId === this.socketId);
      });
      this.socket.on('battleUpdate', ({ actions, playerStates }) => {
        console.log('전투 결과:', actions);
        this.myState = playerStates.find(ps => ps.socketId === this.socketId);
      });
      this.socket.on('gameEnded', () => {
        alert('게임 종료!');
        this.$router.push('/lobby');
      });
    },
    joinCurrentRoom() {
      const roomId = this.$route.params.roomId;
      this.socket.emit('joinRoom', roomId, this.username);
    },
    sendMessage() {
      if (this.chatMessage.trim() && this.currentRoom) {
        this.socket.emit('chatMessage', this.chatMessage, this.currentRoom._id, this.username);
        this.chatMessage = '';
      }
    },
    leaveRoom() {
      if (this.currentRoom) {
        this.socket.emit('leaveRoom', this.currentRoom._id);
      }
    },
    startGame() {
      if (this.currentRoom) {
        this.socket.emit('startGame', this.currentRoom._id, this.username);
      }
    },
    buyCard(cardId) {
      this.socket.emit('buyCard', this.currentRoom._id, cardId);
    },
    placeCard(position) {
      if (this.gameState.phase === 'prepare' && this.myState.cards.length > this.board.length) {
        const cardId = this.myState.cards[this.board.length];
        this.socket.emit('placeCard', this.currentRoom._id, cardId, position);
      }
    },
    ready() {
      this.socket.emit('ready', this.currentRoom._id);
    }
  },
  beforeDestroy() {
    this.socket.disconnect();
  }
};
</script>

<style scoped>
.game-screen {
  padding: 20px;
  height: 100vh;
}
.game-area {
  display: flex;
  gap: 20px;
}
.player-board, .enemy-board {
  flex: 1;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 50px);
  gap: 5px;
}
.grid div {
  width: 50px;
  height: 50px;
  border: 1px solid #ccc;
  text-align: center;
  line-height: 50px;
}
.occupied {
  background: #ddd;
}
.shop {
  position: fixed;
  bottom: 200px;
  width: 100%;
  padding: 10px;
  background: #f0f0f0;
}
.chat-container {
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 200px;
  background: #e0e0e0;
}
.chat-messages {
  height: 160px;
  overflow-y: auto;
  padding: 10px;
}
.chat-input {
  display: flex;
  padding: 10px;
}
</style>