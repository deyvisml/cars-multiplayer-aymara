const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sirve TODO lo que está dentro de /public
app.use(express.static(path.join(__dirname, "public")));

// Rutas de páginas
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/game", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "game.html"))
);

app.get("/red", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "red.html"))
);

// ✅ Aquí debajo dejas tu lógica socket.io (lo que ya tengas)
io.on("connection", (socket) => {
  // ...
});

server.listen(3000, () => console.log("http://localhost:3000"));
