import Phaser from "phaser";

const ASSET_BASE_PATH = "assets";

// Spritesheet do player:
// - grade 8 colunas × 4 linhas
// - cada quadro 256×256 px
const PLAYER_FRAME_WIDTH = 256;
const PLAYER_FRAME_HEIGHT = 256;
const PLAYER_SHEET_COLUMNS = 8;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const previousPath = this.load.path;
    this.load.setPath(ASSET_BASE_PATH);

    // IMPORTANTE: use o arquivo baixado e salve como "assets/char.png"
    // (8×4 frames = 2048×1024, sem margin/spacing)
    this.load.spritesheet("player", "char.png", {
      frameWidth: PLAYER_FRAME_WIDTH,
      frameHeight: PLAYER_FRAME_HEIGHT,
      // margin: 0,
      // spacing: 0,
    });

    // Demais assets estáticos
    this.load.image("monster", "monster.png");
    this.load.image("drop", "drop.png");
    this.load.image("ground-tile", "ground-tile.png");

    this.load.setPath(previousPath ?? "");
  }

  create() {
    this.createPlayerAnimations();
    this.scene.start("HubScene");
  }

  /**
   * Converte (linha, coluna) -> índice linear do spritesheet.
   * Ex.: (row=1, col=0) => frame 8, (row=1, col=7) => frame 15.
   */
  private idx(row: number, col: number) {
    return row * PLAYER_SHEET_COLUMNS + col;
  }

  /** Retorna um array de frames [colStart..colEnd] dentro da linha dada. */
  private rowRange(row: number, colStart = 0, colEnd = 7) {
    const out: number[] = [];
    for (let c = colStart; c <= colEnd; c++) out.push(this.idx(row, c));
    return out;
  }

  private createPlayerAnimations() {
    if (this.anims.exists("player-idle")) return;

    // Mapeamento por linhas do spritesheet (8 frames por ação):
    // Linha 0: IDLE   -> cols 0..7
    // Linha 1: RUN    -> cols 0..7
    // Linha 2: ATTACK -> cols 0..7
    // Linha 3: PICKUP -> cols 0..7

    // IDLE — respiração sutil
    this.anims.create({
      key: "player-idle",
      frames: this.anims.generateFrameNumbers("player", {
        frames: this.rowRange(0, 0, 7),
      }),
      frameRate: 6,
      repeat: -1
    });

    // RUN — ciclo completo (contact → down → passing → up)
    this.anims.create({
      key: "player-run",
      frames: this.anims.generateFrameNumbers("player", {
        frames: this.rowRange(1, 0, 7),
      }),
      frameRate: 12, // pode ir até 14 para mais velocidade
      repeat: -1
    });

    // ATTACK — antecipação → golpe com trilha → recuperação
    this.anims.create({
      key: "player-attack",
      frames: this.anims.generateFrameNumbers("player", {
        frames: this.rowRange(2, 0, 7),
      }),
      frameRate: 14,
      repeat: 0
    });

    // PICKUP — agacha, pega item (livro brilhante), retorna
    this.anims.create({
      key: "player-pickup",
      frames: this.anims.generateFrameNumbers("player", {
        frames: this.rowRange(3, 0, 7),
      }),
      frameRate: 10,
      repeat: 0
    });
  }
}
