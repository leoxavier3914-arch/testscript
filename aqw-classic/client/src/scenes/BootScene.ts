import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Player placeholder (circle)
    graphics.fillStyle(0x4caf50, 1);
    graphics.fillCircle(32, 32, 28);
    graphics.lineStyle(2, 0xffffff);
    graphics.strokeCircle(32, 32, 28);
    graphics.generateTexture("player", 64, 64);
    graphics.clear();

    // Monster placeholder (square)
    graphics.fillStyle(0xe53935, 1);
    graphics.fillRect(0, 0, 64, 64);
    graphics.lineStyle(2, 0xffffff);
    graphics.strokeRect(0, 0, 64, 64);
    graphics.generateTexture("monster", 64, 64);
    graphics.clear();

    // Drop placeholder (triangle)
    graphics.fillStyle(0xffd54f, 1);
    graphics.beginPath();
    graphics.moveTo(32, 0);
    graphics.lineTo(0, 64);
    graphics.lineTo(64, 64);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture("drop", 64, 64);
    graphics.destroy();
  }

  create() {
    this.scene.start("HubScene");
  }
}
