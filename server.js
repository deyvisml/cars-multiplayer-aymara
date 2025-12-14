const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {
  player1: { distance: 0 },
  player2: { distance: 0 },
};

let gameFinished = false;
let winner = null;

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  socket.emit("currentPlayers", players);

  // 🔴 YA NO usamos "move"
  socket.on("analyzeResult", ({ player, similarity }) => {
    if (gameFinished) return;

    if (similarity > 50 && players[player]) {
      players[player].distance += similarity * 0.2;

      io.emit("updatePlayers", players);
    }
  });

  socket.on("playerFinished", ({ player }) => {
    if (gameFinished) return;

    gameFinished = true;
    winner = player;

    io.emit("gameOver", { winner });
  });

  socket.on("disconnect", () => {
    console.log("Jugador desconectado");
  });
});

server.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});
