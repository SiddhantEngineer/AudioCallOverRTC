const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static("public")); // serve index.html and script.js

io.on("connection", (socket) => {
  socket.on("join", (room) => {
    socket.join(room);
    const clients = io.sockets.adapter.rooms.get(room);
    const numClients = clients ? clients.size : 0;

    console.log(`User ${socket.id} joined room ${room}`);

    if (numClients === 1) {
      socket.emit("created");
    } else if (numClients === 2) {
      socket.emit("joined");
      socket.to(room).emit("ready"); // Notify caller to create offer
    }
  });

  socket.on("signal", ({ room, data }) => {
    socket.to(room).emit("signal", data);
  });
});

server.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
