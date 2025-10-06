import Phaser from "phaser";

const ASSET_BASE_PATH = "assets";
// Ajuste estas constantes se trocar o spritesheet do personagem.
const PLAYER_FRAME_WIDTH = 256;
const PLAYER_FRAME_HEIGHT = 256;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const previousPath = this.load.path;
    this.load.setPath(ASSET_BASE_PATH);
    this.load.spritesheet("player", "char.png", {
      frameWidth: PLAYER_FRAME_WIDTH,
      frameHeight: PLAYER_FRAME_HEIGHT
    });
    this.load.image("monster", "monster.png");
    this.load.image("drop", "drop.png");
    this.load.image("ground-tile", "ground-tile.png");
    this.load.setPath(previousPath ?? "");
  }

  create() {
    this.createPlayerAnimations();
    this.scene.start("HubScene");
  }

  private createPlayerAnimations() {
    if (this.anims.exists("player-idle")) {
      return;
    }

    this.anims.create({
      key: "player-idle",
      frames: [{ key: "player", frame: 0 }],
      frameRate: 1,
      repeat: -1
    });

    this.anims.create({
      key: "player-run",
      frames: this.anims.generateFrameNumbers("player", { frames: [0, 1, 2] }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: "player-attack",
      frames: this.anims.generateFrameNumbers("player", { frames: [3, 4, 5, 6] }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: "player-pickup",
      frames: this.anims.generateFrameNumbers("player", { frames: [7, 8, 9, 10, 11] }),
      frameRate: 10,
      repeat: 0
    });
  }
}
