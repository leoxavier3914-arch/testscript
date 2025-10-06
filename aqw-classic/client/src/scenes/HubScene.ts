import Phaser from "phaser";
import {
  getSessionId,
  on,
  requestPickup,
  sendAttack,
  sendMovement,
  waitForRoom
} from "../net/connection";
import ChatUI from "../ui/ChatUI";
import type { DropState, PlayerState, Snapshot } from "../types";

type PlayerEntity = {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
};

type MonsterEntity = {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
};

type DropEntity = {
  sprite: Phaser.GameObjects.Image;
};

const MOVE_RATE_MS = 80;
const INTERPOLATION_SPEED = 0.2;

export default class HubScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { [key: string]: Phaser.Input.Keyboard.Key };
  private attackKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private chatUI?: ChatUI;
  private unlisten: (() => void)[] = [];
  private playerEntities = new Map<string, PlayerEntity>();
  private monsterEntities = new Map<string, MonsterEntity>();
  private dropEntities = new Map<string, DropEntity>();
  private lastMoveSent = 0;
  private hudText!: Phaser.GameObjects.Text;
  private localState?: PlayerState;
  private pendingDrops: Record<string, DropState> = {};

  constructor() {
    super("HubScene");
  }

  async create() {
    this.addGround();
    this.cameras.main.setBounds(0, 0, 1920, 1080);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.chatUI = new ChatUI();

    this.hudText = this.add.text(16, 16, "Conectando...", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: "monospace"
    });
    this.hudText.setScrollFactor(0);

    await waitForRoom();

    this.unlisten.push(
      on("state", (snapshot) => {
        this.syncState(snapshot);
      })
    );
  }

  private addGround() {
    const colors = [0x1e272e, 0x2f3640];
    const tileSize = 128;
    for (let y = 0; y < 1080; y += tileSize) {
      for (let x = 0; x < 1920; x += tileSize) {
        const color = colors[(x / tileSize + y / tileSize) % colors.length];
        const rect = this.add.rectangle(x + tileSize / 2, y + tileSize / 2, tileSize, tileSize, color);
        rect.setStrokeStyle(2, 0x121212);
      }
    }
  }

  update(time: number, delta: number) {
    if (!this.localState) {
      return;
    }

    this.handleInput(time);
    this.interpolateEntities(delta);
    this.updateHud();
  }

  private handleInput(time: number) {
    const dirX = (this.cursors.left?.isDown || this.wasd.A.isDown ? -1 : 0) +
      (this.cursors.right?.isDown || this.wasd.D.isDown ? 1 : 0);
    const dirY = (this.cursors.up?.isDown || this.wasd.W.isDown ? -1 : 0) +
      (this.cursors.down?.isDown || this.wasd.S.isDown ? 1 : 0);

    if (dirX !== 0 || dirY !== 0) {
      const magnitude = Math.hypot(dirX, dirY) || 1;
      const normalized = { x: dirX / magnitude, y: dirY / magnitude };
      if (time - this.lastMoveSent > MOVE_RATE_MS) {
        sendMovement(normalized);
        this.lastMoveSent = time;
      }
    } else if (time - this.lastMoveSent > MOVE_RATE_MS) {
      sendMovement({ x: 0, y: 0 });
      this.lastMoveSent = time;
    }

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      sendAttack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      const drop = this.findDropNearPlayer();
      if (drop) {
        requestPickup(drop.id);
      }
    }
  }

  private interpolateEntities(delta: number) {
    this.playerEntities.forEach((entity, id) => {
      if (id === getSessionId()) {
        entity.sprite.setPosition(this.localState!.x, this.localState!.y);
        entity.label.setPosition(entity.sprite.x - 32, entity.sprite.y - 48);
      } else {
        entity.sprite.x = Phaser.Math.Linear(entity.sprite.x, entity.targetX, INTERPOLATION_SPEED);
        entity.sprite.y = Phaser.Math.Linear(entity.sprite.y, entity.targetY, INTERPOLATION_SPEED);
        entity.label.setPosition(entity.sprite.x - 32, entity.sprite.y - 48);
      }
    });

    this.monsterEntities.forEach((entity) => {
      entity.label.setPosition(entity.sprite.x - 32, entity.sprite.y - 48);
    });
  }

  private findDropNearPlayer() {
    const player = this.localState;
    if (!player) return null;
    const drops = Object.values(this.pendingDrops);
    return drops.find((drop) => Phaser.Math.Distance.Between(player.x, player.y, drop.x, drop.y) < 64) ?? null;
  }

  private updateHud() {
    if (!this.localState) return;
    const inventory = this.localState.inventory.join(", ") || "(vazio)";
    this.hudText.setText(
      `Jogador: ${this.localState.name}\nHP: ${this.localState.hp}/${this.localState.maxHp}\nATK: ${this.localState.atk}` +
        `\nXP: ${this.localState.xp} | Gold: ${this.localState.gold}\nEquipado: ${this.localState.equippedItemId ?? "Nenhum"}\nInventário: ${inventory}`
    );
  }

  private syncState(snapshot: Snapshot) {
    const sessionId = getSessionId();

    // Players
    const existingIds = new Set(this.playerEntities.keys());
    Object.values(snapshot.players).forEach((player) => {
      let entity = this.playerEntities.get(player.id);
      if (!entity) {
        const sprite = this.add.image(player.x, player.y, "player");
        sprite.setDisplaySize(48, 48);
        const label = this.add.text(player.x - 32, player.y - 48, player.name, {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: "monospace"
        });
        entity = { sprite, label, targetX: player.x, targetY: player.y };
        this.playerEntities.set(player.id, entity);
      }
      entity.targetX = player.x;
      entity.targetY = player.y;
      entity.label.setText(player.name);
      if (player.id === sessionId) {
        this.localState = player;
        this.cameras.main.startFollow(entity.sprite, false, 0.08, 0.08);
      }
      existingIds.delete(player.id);
    });
    existingIds.forEach((id) => {
      const entity = this.playerEntities.get(id);
      entity?.sprite.destroy();
      entity?.label.destroy();
      this.playerEntities.delete(id);
    });

    // Monsters
    const monsterIds = new Set(this.monsterEntities.keys());
    Object.values(snapshot.monsters).forEach((monster) => {
      let entity = this.monsterEntities.get(monster.id);
      if (!entity) {
        const sprite = this.add.image(monster.x, monster.y, "monster");
        sprite.setDisplaySize(56, 56);
        const label = this.add.text(monster.x - 32, monster.y - 48, monster.type, {
          fontSize: "12px",
          color: "#ffb3b3",
          fontFamily: "monospace"
        });
        entity = { sprite, label };
        this.monsterEntities.set(monster.id, entity);
      } else {
        entity.sprite.setPosition(monster.x, monster.y);
      }
      entity.label.setText(`${monster.type} (${monster.hp}/${monster.maxHp})`);
      monsterIds.delete(monster.id);
    });
    monsterIds.forEach((id) => {
      const entity = this.monsterEntities.get(id);
      entity?.sprite.destroy();
      entity?.label.destroy();
      this.monsterEntities.delete(id);
    });

    // Drops
    this.pendingDrops = snapshot.drops;
    const dropIds = new Set(this.dropEntities.keys());
    Object.values(snapshot.drops).forEach((drop) => {
      let entity = this.dropEntities.get(drop.id);
      if (!entity) {
        const sprite = this.add.image(drop.x, drop.y, "drop");
        sprite.setDisplaySize(32, 32);
        entity = { sprite };
        this.dropEntities.set(drop.id, entity);
      } else {
        entity.sprite.setPosition(drop.x, drop.y);
      }
      dropIds.delete(drop.id);
    });
    dropIds.forEach((id) => {
      const entity = this.dropEntities.get(id);
      entity?.sprite.destroy();
      this.dropEntities.delete(id);
    });
  }

  destroy() {
    this.unlisten.forEach((fn) => fn());
    this.chatUI?.destroy();
  }
}
