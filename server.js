const express = require("express");
const http = require("http");
const os = require("os");
const path = require("path");
const { Server } = require("socket.io");
const crypto = require("crypto");
const QRCode = require("qrcode");
const readData = require("./readData");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Absoluter Pfad, damit der Server auch funktioniert, wenn er aus einem
// anderen Ordner gestartet wird (z. B. über VS Code)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

/**
 * Ermittelt die IP-Adresse dieses Computers im WLAN/LAN,
 * damit andere Geräte (z. B. Handys) über den QR-Code beitreten können.
 */
function getLocalIp() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "localhost";
}

/**
 * Liefert den Beitritts-Link und den passenden QR-Code (als Bild) für einen Room.
 * Der QR-Code wird hier am Server mit dem npm-Paket "qrcode" erzeugt.
 */
app.get("/api/join-info", async (req, res) => {
  const roomCode = String(req.query.room || "").toUpperCase();

  if (!rooms.has(roomCode)) {
    return res.status(404).json({ error: "Room existiert nicht." });
  }

  // "localhost" funktioniert nur auf diesem Computer → für andere Geräte die LAN-IP verwenden
  let host = req.get("host");
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    host = `${getLocalIp()}:${PORT}`;
  }

  const joinUrl = `http://${host}/?room=${roomCode}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 220, margin: 1 });
    res.json({ joinUrl, qrDataUrl });
  } catch (error) {
    console.error("[QR-CODE] Fehler:", error);
    res.status(500).json({ error: "QR-Code konnte nicht erstellt werden." });
  }
});
const rooms = new Map();

const questions = readData();
const MAX_QUESTIONS = 7;
const QUESTION_TRANSITION_TIME = 2500; // Zeit zwischen Fragen

/**
 * Generiert einen eindeutigen 6-stelligen Room-Code
 */
function createRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/**
 * Gibt eine sortierte Liste aller Spieler im Room zurück
 */
function getRoomPlayers(room) {
  return Array.from(room.players.values()).map(player => ({
    username: player.username,
    score: player.score,
    answered: player.answered
  }));
}

/**
 * Sendet die finale Rangliste an alle Spieler
 */
function sendRanking(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const ranking = getRoomPlayers(room)
    .sort((a, b) => b.score - a.score);

  io.to(roomCode).emit("game-finished", { ranking });

  // Room nach 30 Sekunden löschen
  setTimeout(() => {
    rooms.delete(roomCode);
  }, 30000);
}

/**
 * Startet die nächste Frage oder beendet das Spiel
 */
function startQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Game Over Check
  if (room.questionIndex >= MAX_QUESTIONS) {
    sendRanking(roomCode);
    return;
  }

  const question = questions[room.questionIndex];
  if (!question) {
    sendRanking(roomCode);
    return;
  }

  // Spieler-State zurücksetzen
  room.players.forEach(player => {
    player.answered = false;
  });

  // Room-State für neue Frage
  room.questionStartedAt = Date.now();
  room.answersGiven = new Set();
  room.questionFinished = false;

  // Frage an alle Spieler senden
  io.to(roomCode).emit("new-question", {
    questionNumber: room.questionIndex + 1,
    totalQuestions: MAX_QUESTIONS,
    text: question.text,
    answers: question.answers,
    timeLimit: room.timeLimit
  });

  // Alten Timer löschen
  clearTimeout(room.timer);

  // Neuen Timer für Frage starten
  room.timer = setTimeout(() => {
    finishQuestion(roomCode);
  }, room.timeLimit * 1000);
}

/**
 * Beendet die aktuelle Frage und zeigt die richtige Antwort
 */
function finishQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.questionFinished) return;

  room.questionFinished = true;

  const question = questions[room.questionIndex];

  // Korrekte Antwort an alle senden
  io.to(roomCode).emit("question-finished", {
    correctAnswer: question.correct
  });

  // Nach 2.5 Sekunden nächste Frage starten
  setTimeout(() => {
    const currentRoom = rooms.get(roomCode);
    if (!currentRoom) return;

    currentRoom.questionIndex++;

    if (currentRoom.questionIndex >= MAX_QUESTIONS) {
      sendRanking(roomCode);
    } else {
      startQuestion(roomCode);
    }
  }, QUESTION_TRANSITION_TIME);
}

/**
 * Socket.IO Event Listener
 */
io.on("connection", socket => {
  console.log(`[CONNECT] Socket ${socket.id} verbunden`);

  /**
   * Host erstellt einen neuen Quiz-Room
   */
  socket.on("create-room", ({ username }) => {
    // Eindeutigen Room-Code generieren
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
      timer: null,
      questionStartedAt: null
    };

    // Host als ersten Spieler hinzufügen
    room.players.set(socket.id, {
      username: username?.trim() || "Spielleitung",
      score: 0,
      answered: false
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);

    console.log(`[CREATE-ROOM] ${socket.id} erstellt Room ${roomCode}`);

    socket.emit("room-created", {
      roomCode,
      players: getRoomPlayers(room)
    });
  });

  /**
   * Spieler tritt einem bestehenden Room bei
   */
  socket.on("join-room", ({ roomCode, username }) => {
    const room = rooms.get(roomCode);

    // Fehlerbehandlung
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

    // Duplicate Username Check
    const alreadyUsed = Array.from(room.players.values())
      .some(player => player.username.toLowerCase() === cleanUsername.toLowerCase());

    if (alreadyUsed) {
      socket.emit("error-message", "Dieser Username ist bereits vergeben.");
      return;
    }

    // Spieler hinzufügen
    room.players.set(socket.id, {
      username: cleanUsername,
      score: 0,
      answered: false
    });

    socket.join(roomCode);

    console.log(`[JOIN-ROOM] ${socket.id} (${cleanUsername}) tritt Room ${roomCode} bei`);

    socket.emit("joined-room", {
      roomCode,
      isHost: false
    });

    // Alle Spieler über Update informieren
    io.to(roomCode).emit("players-updated", getRoomPlayers(room));
  });

  /**
   * Host startet das Quiz
   */
  socket.on("start-game", ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("error-message", "Room existiert nicht.");
      return;
    }

    if (room.hostId !== socket.id) {
      socket.emit("error-message", "Nur der Host kann das Spiel starten.");
      return;
    }

    if (room.players.size < 1) {
      socket.emit("error-message", "Es müssen mindestens 2 Spieler im Room sein.");
      return;
    }

    room.gameStarted = true;

    console.log(`[START-GAME] Room ${roomCode} startet mit ${room.players.size} Spielern`);

    io.to(roomCode).emit("game-started");
    startQuestion(roomCode);
  });

  /**
   * Spieler sendet eine Antwort
   */
  socket.on("submit-answer", ({ roomCode, answerIndex }) => {
    const room = rooms.get(roomCode);

    // Validierungen
    if (!room) return;
    if (!room.gameStarted) return;
    if (room.questionFinished) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Spieler hat bereits geantwortet
    if (room.answersGiven.has(socket.id)) return;

    const question = questions[room.questionIndex];
    if (!question) return;

    // Index validieren
    if (typeof answerIndex !== "number" || answerIndex < 0 || answerIndex >= question.answers.length) {
      socket.emit("error-message", "Ungültige Antwort.");
      return;
    }

    // Antwort registrieren
    room.answersGiven.add(socket.id);
    player.answered = true;

    // Punkte berechnen (basierend auf verbleibender Zeit)
    const elapsed = Date.now() - room.questionStartedAt;
    const remaining = Math.max(0, room.timeLimit * 1000 - elapsed);
    let points = 0;

    if (answerIndex === question.correct) {
      points = Math.ceil((remaining / (room.timeLimit * 1000)) * 1000);
      player.score += points;
    }

    // Feedback an Spieler
    socket.emit("answer-result", {
      correct: answerIndex === question.correct,
      points: points,
      correctAnswer: question.correct
    });

    console.log(`[ANSWER] ${socket.id} antwortet: ${answerIndex === question.correct ? "RICHTIG" : "FALSCH"} (+${points})`);

    // Alle Spieler updaten
    io.to(roomCode).emit("players-updated", getRoomPlayers(room));

    // Alle Spieler geantwortet? → Frage beenden
    if (room.answersGiven.size >= room.players.size) {
      clearTimeout(room.timer);
      finishQuestion(roomCode);
    }
  });

  /**
   * Spieler disconnected
   */
  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] Socket ${socket.id}`);

    for (const [roomCode, room] of rooms.entries()) {
      if (!room.players.has(socket.id)) continue;

      // Spieler aus Room entfernen
      room.players.delete(socket.id);
      room.answersGiven.delete(socket.id);

      // Host disconnected → ganze Room löschen
      if (room.hostId === socket.id) {
        clearTimeout(room.timer);
        io.to(roomCode).emit("error-message", "Die Spielleitung hat das Spiel beendet.");
        rooms.delete(roomCode);
        console.log(`[DELETE-ROOM] Room ${roomCode} gelöscht (Host disconnected)`);
        continue;
      }

      // Andere Spieler updaten
      io.to(roomCode).emit("players-updated", getRoomPlayers(room));

      // Wenn Spiel läuft und alle verbleibenden Spieler geantwortet haben → Frage beenden
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

  /**
   * Fehlerbehandlung
   */
  socket.on("error", (error) => {
    console.error(`[ERROR] Socket ${socket.id}:`, error);
  });
});

/**
 * Server starten
 */
server.listen(PORT, () => {
  console.log(`✅ Quiz Server läuft auf http://localhost:${PORT}`);
  console.log(`📱 Andere Geräte im selben WLAN: http://${getLocalIp()}:${PORT}`);
  console.log(`📊 Max Fragen pro Spiel: ${MAX_QUESTIONS}`);
});

/**
 * Graceful Shutdown
 */
process.on("SIGINT", () => {
  console.log("\n🛑 Server wird heruntergefahren...");
  server.close(() => {
    console.log("✅ Server beendet");
    process.exit(0);
  });
});
