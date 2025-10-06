import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import HubScene from "./scenes/HubScene";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const createGame = (parent: string) =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1b1b2f",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    scene: [BootScene, HubScene]
  });

export default createGame;
