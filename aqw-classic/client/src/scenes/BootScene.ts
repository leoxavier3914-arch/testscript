import Phaser from "phaser";

import {
  CHARACTER_ANIMATION_PRESETS,
  CHARACTER_ANIMATIONS,
  CHARACTER_CLASSES,
  PLAYER_SPRITE_CONFIG,
  getAnimationKey,
  REQUIRED_CHARACTER_ASSETS
} from "../config/characters";

const ASSET_BASE_PATH = "assets";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const previousPath = this.load.path;
    this.load.setPath(ASSET_BASE_PATH);

    if (import.meta.env.DEV) {
      console.info(
        "[BootScene] Assets de personagens necessários:",
        REQUIRED_CHARACTER_ASSETS.map((asset) => `${asset.file} → ${asset.publicPath}`).join(", ")
      );
    }

    // IMPORTANTE: os arquivos abaixo precisam existir em `client/public/assets/`.
    // Veja a lista completa em REQUIRED_CHARACTER_ASSETS (config/characters.ts).
    Object.values(CHARACTER_CLASSES).forEach((definition) => {
      this.load.spritesheet(definition.textureKey, definition.assetPath, {
        frameWidth: PLAYER_SPRITE_CONFIG.frameWidth,
        frameHeight: PLAYER_SPRITE_CONFIG.frameHeight,
      });
      if (definition.attackEffect) {
        this.load.image(definition.attackEffect.textureKey, definition.attackEffect.assetPath);
      }
    });

    // Demais assets estáticos
    this.load.image("monster", "monster.png");
    this.load.image("drop", "drop.png");
    this.load.image("ground-tile", "ground-tile.png");

    this.load.setPath(previousPath ?? "");
  }

  create() {
    this.createCharacterAnimations();
    this.scene.start("HubScene");
  }

  /**
   * Converte (linha, coluna) -> índice linear do spritesheet.
   * Ex.: (row=1, col=0) => frame 8, (row=1, col=7) => frame 15.
   */
  private idx(row: number, col: number) {
    return row * PLAYER_SPRITE_CONFIG.columns + col;
  }

  /** Retorna um array de frames [colStart..colEnd] dentro da linha dada. */
  private rowRange(row: number, colStart = 0, colEnd = 7) {
    const out: number[] = [];
    for (let c = colStart; c <= colEnd; c++) out.push(this.idx(row, c));
    return out;
  }

  private createCharacterAnimations() {
    const sampleKey = getAnimationKey("swordsman", "idle");
    if (this.anims.exists(sampleKey)) {
      return;
    }

    Object.values(CHARACTER_CLASSES).forEach((definition) => {
      CHARACTER_ANIMATIONS.forEach((animation) => {
        const config = CHARACTER_ANIMATION_PRESETS[animation];
        const key = getAnimationKey(definition.id, animation);
        if (this.anims.exists(key)) {
          return;
        }
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(definition.textureKey, {
            frames: this.rowRange(config.row, 0, 7),
          }),
          frameRate: config.frameRate,
          repeat: config.repeat
        });
      });
    });
  }
}
