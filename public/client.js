// ===== Socket.IO Connection =====
const socket = io();
let currentRoomCode = null;
let currentUsername = null;
let isHost = false;
let currentQuestionIndex = 0;
let maxQuestions = 7;
let timeLimit = 15;
let hasAnswered = false;
let timerInterval = null;

// ===== Socket Event Listeners =====

/**
 * Verbindung zum Server hergestellt
 */
socket.on("connect", () => {
  console.log("✅ Mit Server verbunden:", socket.id);
});

/**
 * Raum erfolgreich erstellt
 */
socket.on("room-created", (data) => {
  console.log("🎮 Raum erstellt:", data.roomCode);
  currentRoomCode = data.roomCode;
  isHost = true;
  showScreen("waitingRoom");
  document.getElementById("displayRoomCode").textContent = data.roomCode;
  updatePlayersList(data.players);
  document.getElementById("hostControls").style.display = "flex";
  document.getElementById("playerControls").style.display = "none";
});

/**
 * Erfolgreich einem Raum beigetreten
 */
socket.on("joined-room", (data) => {
  console.log("🎮 Raum beigetreten:", data.roomCode);
  currentRoomCode = data.roomCode;
  isHost = data.isHost;
  showScreen("waitingRoom");
  document.getElementById("displayRoomCode").textContent = data.roomCode;
  document.getElementById("hostControls").style.display = isHost ? "flex" : "none";
  document.getElementById("playerControls").style.display = isHost ? "none" : "flex";
});

/**
 * Spielerliste aktualisiert
 */
socket.on("players-updated", (players) => {
  console.log("👥 Spieler aktualisiert:", players);
  updatePlayersList(players);
});

/**
 * Quiz hat begonnen
 */
socket.on("game-started", () => {
  console.log("🚀 Quiz startet!");
  hasAnswered = false;
});

/**
 * Neue Frage erhalten
 */
socket.on("new-question", (data) => {
  console.log("❓ Neue Frage:", data.questionNumber);
  
  currentQuestionIndex = data.questionNumber - 1;
  maxQuestions = data.totalQuestions;
  timeLimit = data.timeLimit;
  hasAnswered = false;

  showScreen("quizScreen");
  
  // Frage anzeigen
  document.getElementById("questionText").textContent = data.text;
  document.getElementById("questionNumber").textContent = 
    `Frage ${data.questionNumber} von ${data.totalQuestions}`;
  
  // Fortschrittsbalken aktualisieren
  const progress = (data.questionNumber / data.totalQuestions) * 100;
  document.getElementById("progressFill").style.width = progress + "%";
  
  // Antworten anzeigen
  displayAnswers(data.answers);
  
  // Timer starten
  startTimer(data.timeLimit);
  
  // Feedback verstecken
  document.getElementById("feedbackContainer").style.display = "none";
  document.getElementById("answersContainer").style.pointerEvents = "auto";
});

/**
 * Antwort-Ergebnis erhalten
 */
socket.on("answer-result", (data) => {
  console.log("📊 Antwort-Ergebnis:", data);
  
  // Antworten deaktivieren
  document.getElementById("answersContainer").style.pointerEvents = "none";
  
  // Feedback anzeigen
  const feedbackBox = document.getElementById("feedbackBox");
  const feedbackText = document.getElementById("feedbackText");
  const pointsText = document.getElementById("pointsText");
  
  if (data.correct) {
    feedbackBox.className = "feedback-box correct";
    feedbackText.textContent = "✅ Richtig!";
  } else {
    feedbackBox.className = "feedback-box incorrect";
    feedbackText.textContent = "❌ Falsch";
  }
  
  pointsText.textContent = `+${data.points} Punkte`;
  document.getElementById("feedbackContainer").style.display = "block";
  
  // Korrekte Antwort hervorheben
  highlightCorrectAnswer(data.correctAnswer);
});

/**
 * Frage beendet - richtige Antwort anzeigen
 */
socket.on("question-finished", (data) => {
  console.log("⏱️ Frage beendet, korrekte Antwort:", data.correctAnswer);
  
  // Timer stoppen
  clearInterval(timerInterval);
  
  // Antworten deaktivieren
  document.getElementById("answersContainer").style.pointerEvents = "none";
  
  // Falls noch kein Feedback: fehlerhafte Antwort anzeigen
  if (document.getElementById("feedbackContainer").style.display === "none") {
    const feedbackBox = document.getElementById("feedbackBox");
    feedbackBox.className = "feedback-box timeout";
    document.getElementById("feedbackText").textContent = "⏰ Zeit abgelaufen!";
    document.getElementById("pointsText").textContent = "+0 Punkte";
    document.getElementById("feedbackContainer").style.display = "block";
  }
  
  highlightCorrectAnswer(data.correctAnswer);
});

/**
 * Quiz beendet - Endergebnisse anzeigen
 */
socket.on("game-finished", (data) => {
  console.log("🏆 Quiz beendet!", data.ranking);
  
  clearInterval(timerInterval);
  displayRanking(data.ranking);
  showScreen("resultsScreen");
});

/**
 * Fehlermeldung vom Server
 */
socket.on("error-message", (message) => {
  console.error("❌ Fehler:", message);
  showError(message);
});

/**
 * Verbindung getrennt
 */
socket.on("disconnect", () => {
  console.log("❌ Von Server getrennt");
  showError("Verbindung zum Server unterbrochen");
  setTimeout(() => {
    location.reload();
  }, 3000);
});

// ===== UI Functions =====

/**
 * Raum erstellen
 */
function createRoom() {
  const username = document.getElementById("usernameCreate").value.trim();
  
  if (!username) {
    showError("Bitte gib einen Namen ein!");
    return;
  }
  
  currentUsername = username;
  socket.emit("create-room", { username });
}

/**
 * Raum beitreten
 */
function joinRoom() {
  const username = document.getElementById("usernameJoin").value.trim();
  const roomCode = document.getElementById("roomCode").value.trim().toUpperCase();
  
  if (!username) {
    showError("Bitte gib einen Namen ein!");
    return;
  }
  
  if (!roomCode) {
    showError("Bitte gib einen Raum-Code ein!");
    return;
  }
  
  currentUsername = username;
  socket.emit("join-room", { roomCode, username });
}

/**
 * Quiz starten (nur Host)
 */
function startGame() {
  if (!isHost) {
    showError("Nur der Host kann das Quiz starten!");
    return;
  }
  
  socket.emit("start-game", { roomCode: currentRoomCode });
}

/**
 * Antwort einreichen
 */
function submitAnswer(answerIndex) {
  if (hasAnswered) {
    return;
  }
  
  hasAnswered = true;
  
  // Antwort-Button visuell markieren
  const buttons = document.querySelectorAll(".answer-btn");
  buttons[answerIndex].classList.add("selected");
  
  socket.emit("submit-answer", {
    roomCode: currentRoomCode,
    answerIndex
  });
}

/**
 * Spiel verlassen
 */
function leaveGame() {
  currentRoomCode = null;
  currentUsername = null;
  hasAnswered = false;
  clearInterval(timerInterval);
  socket.disconnect();
  showScreen("startScreen");
  document.getElementById("usernameCreate").value = "";
  document.getElementById("usernameJoin").value = "";
  document.getElementById("roomCode").value = "";
  setTimeout(() => {
    socket.connect();
  }, 500);
}

/**
 * Zur Startseite zurück
 */
function backToStart() {
  leaveGame();
}

/**
 * Raum-Code kopieren
 */
function copyCode() {
  const code = document.getElementById("displayRoomCode").textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "✅ Kopiert!";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  });
}

// ===== Display Functions =====

/**
 * Bildschirm wechseln
 */
function showScreen(screenId) {
  // Alle Bildschirme verstecken
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  
  // Gewünschten Bildschirm anzeigen
  document.getElementById(screenId).classList.add("active");
}

/**
 * Spielerliste aktualisieren
 */
function updatePlayersList(players) {
  const playersList = document.getElementById("playersList");
  playersList.innerHTML = "";
  
  players.forEach((player, index) => {
    const playerElement = document.createElement("div");
    playerElement.className = "player-item";
    
    let medal = "";
    if (index === 0) medal = "🥇";
    else if (index === 1) medal = "🥈";
    else if (index === 2) medal = "🥉";
    
    playerElement.innerHTML = `
      <div class="player-name">${medal} ${player.username}</div>
      <div class="player-score">${player.score} Punkte</div>
      <div class="player-status">${player.answered ? "✅ Geantwortet" : "⏳ Wartet..."}</div>
    `;
    
    playersList.appendChild(playerElement);
  });
}

/**
 * Antworten anzeigen
 */
function displayAnswers(answers) {
  const container = document.getElementById("answersContainer");
  container.innerHTML = "";
  
  answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.textContent = answer;
    button.onclick = () => submitAnswer(index);
    container.appendChild(button);
  });
}

/**
 * Korrekte Antwort hervorheben
 */
function highlightCorrectAnswer(correctIndex) {
  const buttons = document.querySelectorAll(".answer-btn");
  buttons.forEach((btn, index) => {
    if (index === correctIndex) {
      btn.classList.add("correct");
    } else if (btn.classList.contains("selected")) {
      btn.classList.add("incorrect");
    }
  });
}

/**
 * Scoreboard anzeigen
 */
function displayScoreboard(players) {
  const scoreboard = document.getElementById("scoreboardContainer");
  scoreboard.innerHTML = "";
  
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  sortedPlayers.forEach((player, index) => {
    const playerElement = document.createElement("div");
    playerElement.className = "scoreboard-item";
    
    let medal = "";
    if (index === 0) medal = "🥇";
    else if (index === 1) medal = "🥈";
    else if (index === 2) medal = "🥉";
    
    playerElement.innerHTML = `
      <span>${medal} ${player.username}</span>
      <span class="score">${player.score}</span>
    `;
    
    scoreboard.appendChild(playerElement);
  });
}

/**
 * Enderanking anzeigen
 */
function displayRanking(ranking) {
  const container = document.getElementById("rankingContainer");
  container.innerHTML = "";
  
  ranking.forEach((player, index) => {
    const rankElement = document.createElement("div");
    rankElement.className = "rank-item";
    
    let medal = "";
    let title = "";
    
    if (index === 0) {
      medal = "🥇";
      title = "1. Platz";
    } else if (index === 1) {
      medal = "🥈";
      title = "2. Platz";
    } else if (index === 2) {
      medal = "🥉";
      title = "3. Platz";
    } else {
      medal = "⭐";
      title = (index + 1) + ". Platz";
    }
    
    rankElement.innerHTML = `
      <div class="rank-position">${medal}</div>
      <div class="rank-info">
        <div class="rank-name">${player.username}</div>
        <div class="rank-title">${title}</div>
      </div>
      <div class="rank-score">${player.score}</div>
    `;
    
    container.appendChild(rankElement);
  });
}

/**
 * Timer starten
 */
function startTimer(seconds) {
  let remaining = seconds;
  const timerElement = document.getElementById("timer");
  
  // Sofort anzeigen
  timerElement.textContent = remaining + "s";
  
  clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    remaining--;
    timerElement.textContent = remaining + "s";
    
    // Farbe ändern wenn Zeit knapp wird
    if (remaining <= 5) {
      timerElement.style.color = "#ff4444";
    } else {
      timerElement.style.color = "#333";
    }
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

/**
 * Fehlermeldung anzeigen
 */
function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  
  setTimeout(() => {
    errorDiv.style.display = "none";
  }, 5000);
}

/**
 * Update Scoreboard bei players-updated
 */
socket.on("players-updated", (players) => {
  console.log("👥 Spieler aktualisiert:", players);
  updatePlayersList(players);
  
  // Falls Quiz läuft: Scoreboard aktualisieren
  if (document.getElementById("quizScreen").classList.contains("active")) {
    displayScoreboard(players);
  }
});

console.log("🎮 Client ready - warte auf Verbindung...");
