import createGame from "./phaserGame";
import { connectToServer, getStoredPlayerClass, getStoredPlayerName } from "./net/connection";
import HeroSelectionUI from "./ui/HeroSelectionUI";

const containerId = "game-container";
createGame(containerId);

void (async () => {
  const selectionUI = new HeroSelectionUI({
    defaultName: getStoredPlayerName(),
    defaultClass: getStoredPlayerClass()
  });

  while (true) {
    const profile = await selectionUI.prompt();
    try {
      await connectToServer(profile);
      selectionUI.destroy();
      break;
    } catch (err) {
      console.error("Failed to connect to Colyseus server", err);
      selectionUI.showError("Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.");
    }
  }
})();
