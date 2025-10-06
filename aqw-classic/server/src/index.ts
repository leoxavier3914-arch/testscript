import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { VerifyClientCallbackAsync } from "ws";
import dotenv from "dotenv";
import GameRoom from "./rooms/GameRoom.js";

dotenv.config();

const port = Number(process.env.PORT ?? 2567);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const httpServer = createServer();

const verifyClient: VerifyClientCallbackAsync = (info, done) => {
  const origin = info.origin ?? "";
  if (!origin || corsOrigin === "*" || origin === corsOrigin) {
    done(true);
    return;
  }
  console.warn(`Conexão websocket bloqueada pelo origin: ${origin}`);
  done(false, 403, "Forbidden");
};

const transport = new WebSocketTransport({
  server: httpServer,
  verifyClient
});

const gameServer = new Server({
  transport
});

gameServer.define("game", GameRoom, { map: "hub" }).filterBy(["map"]);

gameServer.listen(port);

console.log(`Colyseus server rodando na porta ${port} (CORS: ${corsOrigin})`);
