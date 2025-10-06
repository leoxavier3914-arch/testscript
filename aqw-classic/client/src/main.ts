import createGame from "./phaserGame";
import { connectToServer } from "./net/connection";

const containerId = "game-container";
createGame(containerId);

void (async () => {
  try {
    await connectToServer();
  } catch (err) {
    console.error("Failed to connect to Colyseus server", err);
  }
})();
