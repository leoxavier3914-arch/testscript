import Phaser from "phaser";

const ASSET_BASE_PATH = "assets/kenney";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.setPath(ASSET_BASE_PATH);
    this.load.image("player", "player.png");
    this.load.image("monster", "monster.png");
    this.load.image("drop", "drop.png");
    this.load.image("ground-tile", "ground-tile.png");
    this.load.resetPath();
  }

  create() {
    this.scene.start("HubScene");
  }
}
