const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const readData = require("./readData");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = 3000;
const rooms = new Map();

const questions = readData();

function createRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function getRoomPlayers(room) {
  return Array.from(room.players.values()).map(player => ({
    username: player.username,
    score: player.score
  }));
}

function sendRanking(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const ranking = getRoomPlayers(room)
    .sort((a, b) => b.score - a.score);

  io.to(roomCode).emit("game-finished", ranking);
}

function startQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.questionIndex >= questions.length) {
    sendRanking(roomCode);
    return;
  }

  const question = questions[room.questionIndex];

  room.questionStartedAt = Date.now();
  room.answersGiven = new Set();

  io.to(roomCode).emit("new-question", {
    questionNumber: room.questionIndex + 1,
    totalQuestions: questions.length,
    text: question.text,
    answers: question.answers,
    timeLimit: room.timeLimit
  });

  clearTimeout(room.timer);

  room.timer = setTimeout(() => {
    finishQuestion(roomCode);
  }, room.timeLimit * 1000);
}

function finishQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.questionFinished) return;

  room.questionFinished = true;

  const question = questions[room.questionIndex];

  io.to(roomCode).emit("question-finished", {
    correctAnswer: question.correct
  });

  setTimeout(() => {
    const currentRoom = rooms.get(roomCode);
    if (!currentRoom) return;

    currentRoom.questionIndex++;
    currentRoom.questionFinished = false;

    if (currentRoom.questionIndex >= questions.length) {
      sendRanking(roomCode);
    } else {
      startQuestion(roomCode);
    }
  }, 2500);
}

io.on("connection", socket => {
  socket.on("create-room", ({ username }) => {
    let roomCode = createRoomCode();

    while (rooms.has(roomCode)) {
      roomCode = createRoomCode();
    }

    const room = {
      hostId: socket.id,
      players: new Map(),
      questionIndex: 0,
      timeLimit: 15,
      gameStarted: false,
      questionFinished: false,
      answersGiven: new Set(),
      timer: null
    };

    room.players.set(socket.id, {
      username: username || "Spielleitung",
      score: 0,
      answered: false
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit("room-created", {
      roomCode,
      players: getRoomPlayers(room)
    });
  });

  socket.on("join-room", ({ roomCode, username }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("error-message", "Dieser Spielcode existiert nicht.");
      return;
    }

    if (room.gameStarted) {
      socket.emit("error-message", "Das Quiz hat bereits begonnen.");
      return;
    }

    const cleanUsername = username?.trim();

    if (!cleanUsername) {
      socket.emit("error-message", "Bitte gib einen Usernamen ein.");
      return;
    }

    const alreadyUsed = Array.from(room.players.values())
      .some(player => player.username.toLowerCase() === cleanUsername.toLowerCase());

    if (alreadyUsed) {
      socket.emit("error-message", "Dieser Username ist bereits vergeben.");
      return;
    }

    room.players.set(socket.id, {
      username: cleanUsername,
      score: 0,
      answered: false
    });

    socket.join(roomCode);

    socket.emit("joined-room", {
      roomCode,
      isHost: false
    });

    io.to(roomCode).emit("players-updated", getRoomPlayers(room));
  });

  socket.on("start-game", ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room || room.hostId !== socket.id) return;

    room.gameStarted = true;
    io.to(roomCode).emit("game-started");
    startQuestion(roomCode);
  });

  socket.on("submit-answer", ({ roomCode, answerIndex }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameStarted || room.questionFinished) return;

    const player = room.players.get(socket.id);
    if (!player || room.answersGiven.has(socket.id)) return;

    room.answersGiven.add(socket.id);
    player.answered = true;

    const question = questions[room.questionIndex];
    const elapsed = Date.now() - room.questionStartedAt;
    const remaining = Math.max(0, room.timeLimit * 1000 - elapsed);

    let points = 0;

    if (answerIndex === question.correct) {
      points = Math.ceil((remaining / (room.timeLimit * 1000)) * 1000);
      player.score += points;
    }

    socket.emit("answer-result", {
      correct: answerIndex === question.correct,
      points
    });

    io.to(roomCode).emit("players-updated", getRoomPlayers(room));

    const activePlayers = Array.from(room.players.values());

    if (room.answersGiven.size >= activePlayers.length) {
      clearTimeout(room.timer);
      finishQuestion(roomCode);
    }
  });

  socket.on("disconnect", () => {
    for (const [roomCode, room] of rooms.entries()) {
      if (!room.players.has(socket.id)) continue;

      room.players.delete(socket.id);
      room.answersGiven.delete(socket.id);

      if (room.hostId === socket.id) {
        clearTimeout(room.timer);
        io.to(roomCode).emit("error-message", "Die Spielleitung hat das Spiel beendet.");
        rooms.delete(roomCode);
        continue;
      }

      io.to(roomCode).emit("players-updated", getRoomPlayers(room));

      if (
        room.gameStarted &&
        room.players.size > 0 &&
        room.answersGiven.size >= room.players.size
      ) {
        clearTimeout(room.timer);
        finishQuestion(roomCode);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Quiz läuft auf http://localhost:${PORT}`);
});
