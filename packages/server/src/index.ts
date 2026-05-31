import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@haven/shared";
import { loadGames, listGames } from "./GameLoader";
import * as RM from "./RoomManager";

loadGames();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/games", (_req, res) => {
  res.json(listGames());
});

const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

function broadcast(roomCode: string) {
  const state = RM.getRoomState(roomCode);
  if (state) io.to(roomCode).emit("room:state", state);
}

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("room:create", (playerName, vsAI, callback) => {
    const { room, player } = RM.createRoom(socket.id, playerName, vsAI);
    socket.join(room.code);
    socket.emit("game:list", listGames());
    callback(room, player);
    broadcast(room.code);
  });

  socket.on("room:join", (code, playerName, callback) => {
    const result = RM.joinRoom(socket.id, code, playerName);
    if ("error" in result) {
      socket.emit("room:error", result.error);
      return;
    }
    const { room, player } = result;
    socket.join(room.code);
    socket.emit("game:list", listGames());
    callback(room, player);
    broadcast(room.code);
  });

  socket.on("room:leave", () => {
    const code = RM.leaveRoom(socket.id);
    socket.leave(code ?? "");
    if (code) broadcast(code);
  });

  socket.on("game:select", (gameId) => {
    const code = RM.selectGame(socket.id, gameId);
    if (code) broadcast(code);
  });

  socket.on("game:start", () => {
    const code = RM.startGame(socket.id);
    if (code) broadcast(code);
  });

  socket.on("game:rematch", () => {
    const code = RM.rematch(socket.id);
    if (code) broadcast(code);
  });

  socket.on("game:back-to-lobby", () => {
    const code = RM.backToLobby(socket.id);
    if (code) broadcast(code);
  });

  socket.on("player:action", (action) => {
    const code = RM.handlePlayerAction(socket.id, action);
    if (code) broadcast(code);
  });

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    const code = RM.leaveRoom(socket.id);
    if (code) broadcast(code);
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
