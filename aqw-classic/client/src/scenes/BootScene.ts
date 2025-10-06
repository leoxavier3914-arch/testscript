import Phaser from "phaser";

const ASSET_BASE_PATH = "assets";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.setPath(ASSET_BASE_PATH);
    this.load.spritesheet("player", "char.png", {
      frameWidth: 256,
      frameHeight: 256
    });
    this.load.image("monster", "monster.png");
    this.load.image("drop", "drop.png");
    this.load.image("ground-tile", "ground-tile.png");
    this.load.resetPath();
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
