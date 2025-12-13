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

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  socket.emit("currentPlayers", players);

  // 🔴 YA NO usamos "move"
  socket.on("analyzeResult", ({ player, similarity }) => {
    if (players[player]) {
      console.log(`Jugador ${player} tiene similitud: ${similarity}`);
      const advance = similarity * 0.2; // regla simple
      players[player].distance += advance;

      io.emit("updatePlayers", players);
    }
  });

  socket.on("disconnect", () => {
    console.log("Jugador desconectado");
  });
});

server.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});
