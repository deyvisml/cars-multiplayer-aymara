const params = new URLSearchParams(window.location.search);
const categoryId = params.get("id");          // "1" (string) o null
const categoryIdNum = Number(categoryId);     // 1 (number) o NaN

const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let players = {};
const myPlayer = prompt("Escribe: player1 o player2");

const playerCenterY = canvas.height / 2;
const carWidth = 100;
const carHeight = 80;

const carImgPlayer1 = new Image();
carImgPlayer1.src = "/utils/yellow_car.png";

const carImgPlayer2 = new Image();
carImgPlayer2.src = "/utils/red_card.png";

// opcional: para debug
carImgPlayer1.onload = () => console.log("✅ yellow_car cargado");
carImgPlayer2.onload = () => console.log("✅ red_car cargado");
carImgPlayer1.onerror = () => console.error("❌ No cargó yellow_car");
carImgPlayer2.onerror = () => console.error("❌ No cargó red_car");

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let silenceTimer = null;

let gameOver = false;

const VOICE_THRESHOLD = 15; // ajustar según micrófono
const SILENCE_TIME = 2000; // 2 segundos de silencio

let words = [];

let playerState = {
  currentWordIndex: 0,
};

function stopGame() {
  gameOver = true;

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  console.log("🎤 Grabación detenida (fin del juego)");
}

socket.on("currentPlayers", (data) => {
  players = data;
});

socket.on("updatePlayers", (data) => {
  players = data;
});

socket.on("gameOver", ({ winner }) => {
  stopGame();

  const resultScreen = document.getElementById("result-screen");
  resultScreen.classList.remove("hidden");

  if (winner === myPlayer) {
    resultScreen.textContent = "🏆 YOU WIN";
  } else {
    resultScreen.textContent = "💀 YOU LOSE";
  }
});

function drawRoad(offset) {
  ctx.fillStyle = "#555";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;

  for (let y = -100; y < canvas.height + 100; y += 40) {
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, y + offset);
    ctx.lineTo(canvas.width / 2, y + 20 + offset);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const myDistance = players[myPlayer]?.distance || 0;
  const roadOffset = myDistance % 40;

  drawRoad(roadOffset);

  Object.entries(players).forEach(([id, player], index) => {
    const relativeY = playerCenterY - (player.distance - myDistance);

    // Si está muy lejos, no lo dibujamos (optimización)
    if (relativeY < -100 || relativeY > canvas.height + 100) return;

    // ----------------------
    // ctx.fillStyle = id === myPlayer ? "red" : "blue";
    // const x = id === "player1" ? 250 : 450;
    // ctx.fillRect(x, relativeY - carHeight / 2, carWidth, carHeight);
    // --------------------
    const x = id === "player1" ? 250 : 450;
    const y = relativeY - carHeight / 2;

    const img = id === "player1" ? carImgPlayer1 : carImgPlayer2;

    // Si la imagen aún no cargó, dibuja rectángulo como fallback
    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, carWidth, carHeight);
    } else {
        ctx.fillStyle = id === "player1" ? "yellow" : "red";
        ctx.fillRect(x, y, carWidth, carHeight);
    }
  });

  requestAnimationFrame(draw);
}

async function loadWords() {
  try {

    // const response = await fetch("http://localhost:8000/categories/1/words");  /* version deyvis */
    const response = await fetch("http://127.0.0.1:8000/categories/2/words");  /* version Juan */

    words = await response.json();

    console.log("Palabras cargadas:", words);

    updateWordUI();
  } catch (error) {
    console.error("Error cargando palabras", error);
  }
}

function updateWordUI() {
  const wordElement = document.getElementById("current-word");
  const progressElement = document.getElementById("progress-text");

  if (!words.length) {
    wordElement.textContent = "...";
    progressElement.textContent = "0 / 0";
    return;
  }

  // 🏁 Ya terminó todas las palabras
  if (playerState.currentWordIndex >= words.length) {
    wordElement.textContent = "🏁 Fin";
    progressElement.textContent = `${words.length} / ${words.length}`;
    return;
  }

  // 👉 PALABRA ACTUAL (NO suma al progreso todavía)
  const index = playerState.currentWordIndex;
  const word = words[index];

  wordElement.textContent = word.aymara;

  // 🔑 CLAVE: el progreso es el índice, no índice + 1
  progressElement.textContent = `${index} / ${words.length}`;
}

function updateProgressUI() {
  const progressElement = document.getElementById("progress-text");

  if (!words.length) {
    progressElement.textContent = "0 / 0";
    return;
  }

  const current = playerState.currentWordIndex + 1;
  const total = words.length;

  progressElement.textContent = `${current} / ${total}`;
}

async function initMicrophone() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  analyser.fftSize = 2048;
  source.connect(analyser);

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  mediaRecorder.onstop = handleRecordingStop;

  detectVoice(analyser);
}

function detectVoice(analyser) {
  const data = new Uint8Array(analyser.fftSize);

  function loop() {
    analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i] - 128);
    }

    const volume = sum / data.length;

    if (volume > VOICE_THRESHOLD) {
      if (!isRecording && !gameOver) {
        console.log("🎤 Voz detectada, volumen:", volume.toFixed(2));
        startRecording();
      }
      resetSilenceTimer();
    }

    requestAnimationFrame(loop);
  }

  loop();
}

function startRecording() {
  audioChunks = [];
  isRecording = true;
  mediaRecorder.start();
  console.log("🎙️ Grabando...");
}

function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(stopRecording, SILENCE_TIME);
}

function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  mediaRecorder.stop();
  console.log("🛑 Grabación finalizada");
}

async function handleRecordingStop() {
  if (gameOver) return;

  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

  // 🔹 SIMULACIÓN (luego va el fetch al servicio Python)
  const similarity = await sendAudioForAnalysis(audioBlob);

  console.log("Similarity:", similarity);

  if (similarity > 50) {
    playerState.currentWordIndex++;
    updateWordUI();

    // 🏁 VERIFICAR FIN DEL JUEGO (AQUÍ VA)
    if (playerState.currentWordIndex >= words.length) {
      socket.emit("playerFinished", { player: myPlayer });
    }

    console.log("✅ Palabra correcta → siguiente");

    socket.emit("analyzeResult", {
      player: myPlayer,
      similarity,
    });
  } else {
    console.log("❌ Palabra incorrecta");
  }
}

initMicrophone();

loadWords();

async function sendAudioForAnalysis(audioBlob) {
  // ⛔ Seguridad extra (por si acaso)
  if (gameOver) return 0;

  const formData = new FormData();

  // 1️⃣ Audio
  formData.append("audio", audioBlob, "sample.webm");

  // 3️⃣ Índice de la palabra actual de ESE jugador
  formData.append("word_id", words[playerState.currentWordIndex]?.id || -1);

  const response = await fetch("http://localhost:8000/evaluate", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  console.log("Respuesta del servidor de análisis:", data);

  return data.final_score; // número
}

draw();


