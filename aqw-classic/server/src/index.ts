import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import dotenv from "dotenv";
import GameRoom from "./rooms/GameRoom.js";

dotenv.config();

const port = Number(process.env.PORT ?? 2567);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    options: {
      cors: {
        origin: corsOrigin,
        allowedHeaders: ["*"],
        methods: ["GET", "POST"]
      }
    }
  })
});

gameServer.define("game", GameRoom, { map: "hub" }).filterBy("map");

gameServer.listen(port);

console.log(`Colyseus server rodando na porta ${port} (CORS: ${corsOrigin})`);
