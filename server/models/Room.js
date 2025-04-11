const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, default: '대기' },
  players: [{ type: String }],
  maxPlayers: { type: Number, default: 4 },
  createdAt: { type: Date, default: Date.now },
  gameStarted: { type: Boolean, default: false },
  creator: { type: String },
  playerStates: [{
    socketId: String,
    hp: { type: Number, default: 100 },
    money: { type: Number, default: 1000 },
    cards: [String]
  }]
});

module.exports = mongoose.model('Room', roomSchema);