const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// .env 파일 로드
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB 연결 성공'));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const gameStates = new Map();
const cardPool = {
  'warrior': { speed: 3, hp: 50, attack: 20, passive: 'none', active: 'slash' },
  'archer': { speed: 5, hp: 30, attack: 15, passive: 'range', active: 'shoot' }
};

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    res.status(400).json({ message: '이미 존재하는 사용자' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: '로그인 실패' });
  }
  const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

io.on('connection', (socket) => {
  console.log('새 클라이언트 접속:', socket.id);

  socket.on('init', async (username) => {
    const rooms = await Room.find();
    socket.emit('initData', { rooms, username });
  });

  socket.on('createRoom', async (roomName, username) => {
    const room = new Room({ 
      name: roomName, 
      players: [socket.id], 
      creator: username,
      playerStates: [{ socketId: socket.id, hp: 100, money: 1000, cards: [] }]
    });
    await room.save();
    io.emit('roomList', await Room.find());
    socket.join(room._id.toString());
    socket.emit('joinedRoom', { room, username });
  });

  socket.on('joinRoom', async (roomId, username) => {
    const room = await Room.findById(roomId);
    if (!room) {
      socket.emit('error', '방이 존재하지 않습니다.');
      return;
    }
    if (room.players.length < room.maxPlayers && room.status === '대기') {
      room.players.push(socket.id);
      room.playerStates.push({ socketId: socket.id, hp: 100, money: 1000, cards: [] });
      await room.save();
      io.emit('roomList', await Room.find());
      socket.join(room._id.toString());
      socket.emit('joinedRoom', { room, username });
    }
  });

  socket.on('leaveRoom', async (roomId) => {
    const room = await Room.findById(roomId);
    if (room) {
      room.players = room.players.filter(p => p !== socket.id);
      room.playerStates = room.playerStates.filter(ps => ps.socketId !== socket.id);
      if (room.players.length === 0) {
        await Room.deleteOne({ _id: roomId });
        gameStates.delete(roomId);
      } else {
        await room.save();
      }
      socket.leave(roomId);
      io.emit('roomList', await Room.find());
      socket.emit('leftRoom');
    }
  });

  socket.on('startGame', async (roomId, username) => {
    const room = await Room.findById(roomId);
    if (room && room.creator === username && room.status === '대기') {
      room.status = '시작함';
      room.gameStarted = true;
      await room.save();
      io.emit('roomList', await Room.find());

      const gameState = {
        phase: 'prepare',
        round: 1,
        boards: room.players.reduce((acc, p) => ({ ...acc, [p]: [] }), {})
      };
      gameStates.set(roomId, gameState);
      io.to(roomId).emit('gameStarted', { room, gameState });
    }
  });

  socket.on('buyCard', async (roomId, cardId) => {
    const room = await Room.findById(roomId);
    const gameState = gameStates.get(roomId);
    if (room && gameState.phase === 'prepare') {
      const playerState = room.playerStates.find(ps => ps.socketId === socket.id);
      const card = cardPool[cardId];
      if (playerState.money >= 100 && card) {
        playerState.money -= 100;
        playerState.cards.push(cardId);
        await room.save();
        io.to(roomId).emit('playerUpdate', room.playerStates);
      }
    }
  });

  socket.on('placeCard', (roomId, cardId, position) => {
    const gameState = gameStates.get(roomId);
    if (gameState && gameState.phase === 'prepare') {
      gameState.boards[socket.id].push({ cardId, position });
      io.to(roomId).emit('gameUpdate', gameState);
    }
  });

  socket.on('ready', (roomId) => {
    const gameState = gameStates.get(roomId);
    if (gameState && gameState.phase === 'prepare') {
      gameState.phase = 'battle';
      io.to(roomId).emit('gameUpdate', gameState);
      startBattle(roomId);
    }
  });

  async function startBattle(roomId) {
    const room = await Room.findById(roomId);
    const gameState = gameStates.get(roomId);
    const players = room.players;

    const actions = [];
    players.forEach(p => {
      gameState.boards[p].forEach(card => {
        const cardData = cardPool[card.cardId];
        actions.push({ player: p, card: cardData, speed: cardData.speed });
      });
    });

    actions.sort((a, b) => b.speed - a.speed);
    for (const action of actions) {
      const target = players.find(p => p !== action.player);
      const targetState = room.playerStates.find(ps => ps.socketId === target);
      if (targetState.hp > 0) {
        targetState.hp -= action.card.attack;
        if (targetState.hp <= 0) {
          room.players = room.players.filter(p => p !== target);
          room.playerStates = room.playerStates.filter(ps => ps.socketId !== target);
        }
      }
    }

    await room.save();
    io.to(roomId).emit('battleUpdate', { actions, playerStates: room.playerStates });

    if (room.players.length <= 1) {
      io.to(roomId).emit('gameEnded', { winner: room.players[0] });
      gameStates.delete(roomId);
    } else {
      gameState.phase = 'prepare';
      gameState.round += 1;
      io.to(roomId).emit('gameUpdate', gameState);
    }
  }

  socket.on('chatMessage', async (message, roomId, username) => {
    const room = await Room.findById(roomId);
    if (room && room.players.includes(socket.id)) {
      const msg = new Message({ user: username, text: message, roomId });
      await msg.save();
      io.to(roomId).emit('chatMessage', msg);
    }
  });

  socket.on('disconnect', async () => {
    const rooms = await Room.find();
    rooms.forEach(async (room) => {
      room.players = room.players.filter(p => p !== socket.id);
      room.playerStates = room.playerStates.filter(ps => ps.socketId !== socket.id);
      if (room.players.length === 0) {
        await Room.deleteOne({ _id: room._id });
        gameStates.delete(room._id.toString());
      } else {
        await room.save();
      }
    });
    io.emit('roomList', await Room.find());
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('서버 실행 중: http://localhost:3000');
});