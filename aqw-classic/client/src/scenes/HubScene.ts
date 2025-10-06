import Phaser from "phaser";
import {
  getSessionId,
  on,
  requestPickup,
  sendAttack,
  sendMovement,
  waitForRoom
} from "../net/connection";
import {
  getAnimationKey,
  getAttackEffectConfig,
  getCharacterTextureKey
} from "../config/characters";
import ChatUI from "../ui/ChatUI";
import type { Direction, DropState, PlayerClassId, PlayerState, Snapshot } from "../types";

type PlayerEntity = {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  currentAnim: string;
  isActionLocked: boolean;
  onActionComplete?: () => void;
  classId: PlayerClassId;
  lastDir: Direction;
  lastServerDir: Direction;
};

type MonsterEntity = {
  sprite: Phaser.GameObjects.Image;
  nameLabel: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Graphics;
  healthText: Phaser.GameObjects.Text;
  currentHp: number;
  maxHp: number;
  type: string;
  needsUiRefresh: boolean;
};

type DropEntity = {
  sprite: Phaser.GameObjects.Image;
};

const MOVE_RATE_MS = 80;
const INTERPOLATION_SPEED = 0.2;
const HUD_PANEL_X = 16;
const HUD_PANEL_Y = 16;
const HUD_PANEL_WIDTH = 288;
const HUD_PANEL_HEIGHT = 184;
const HUD_VITALS_OFFSET_X = 20;
const HUD_VITALS_OFFSET_Y = 58;
const HUD_BAR_WIDTH = 220;
const HUD_BAR_HEIGHT = 16;
const MONSTER_BAR_WIDTH = 72;
const MONSTER_BAR_HEIGHT = 10;

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
  private hudStatsText!: Phaser.GameObjects.Text;
  private hudVitalsBar!: Phaser.GameObjects.Graphics;
  private hudVitalsText!: Phaser.GameObjects.Text;
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

    this.createHud();

    await waitForRoom();

    this.unlisten.push(
      on("state", (snapshot) => {
        this.syncState(snapshot);
      })
    );
    this.unlisten.push(
      on("playerAttack", ({ playerId, dir }) => {
        if (playerId === getSessionId()) {
          return;
        }
        this.triggerPlayerAction(playerId, "attack", dir);
      })
    );
  }

  private addGround() {
    const scale = 0.35;
    const texture = this.textures.get("ground-tile");
    const frame = texture.get();
    if (!frame) {
      return;
    }
    const tileWidth = frame.width * scale;
    const tileHeight = frame.height * scale * 0.5;
    const rows = 14;
    const cols = 14;
    const centerX = 960;
    const centerY = 360;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isoX = centerX + (col - row) * (tileWidth / 2);
        const isoY = centerY + (col + row) * (tileHeight / 2);
        const tile = this.add.image(isoX, isoY, "ground-tile");
        tile.setScale(scale);
        tile.setOrigin(0.5, 0.9);
        tile.setDepth(-1000);
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
      const sessionId = getSessionId();
      if (sessionId) {
        this.triggerPlayerAction(sessionId, "attack", this.localState?.dir);
      }
      sendAttack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      const drop = this.findDropNearPlayer();
      if (drop) {
        const sessionId = getSessionId();
        if (sessionId) {
          this.triggerPlayerAction(sessionId, "pickup", this.localState?.dir);
        }
        requestPickup(drop.id);
      }
    }
  }

  private interpolateEntities(delta: number) {
    this.playerEntities.forEach((entity, id) => {
      if (id === getSessionId()) {
        entity.sprite.setPosition(this.localState!.x, this.localState!.y);
      } else {
        entity.sprite.x = Phaser.Math.Linear(entity.sprite.x, entity.targetX, INTERPOLATION_SPEED);
        entity.sprite.y = Phaser.Math.Linear(entity.sprite.y, entity.targetY, INTERPOLATION_SPEED);
      }
      this.updateEntityDepth(entity.sprite);
      entity.label.setDepth(entity.sprite.depth + 1);
      this.positionLabel(entity.label, entity.sprite);
    });

    this.monsterEntities.forEach((entity) => {
      this.refreshMonsterUi(entity);
    });
  }

  private findDropNearPlayer() {
    const player = this.localState;
    if (!player) return null;
    const drops = Object.values(this.pendingDrops);
    return drops.find((drop) => Phaser.Math.Distance.Between(player.x, player.y, drop.x, drop.y) < 64) ?? null;
  }

  private createHud() {
    const background = this.add.graphics();
    background.setScrollFactor(0);
    background.setDepth(1000);
    background.fillStyle(0x050913, 0.88);
    background.fillRoundedRect(HUD_PANEL_X, HUD_PANEL_Y, HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT, 18);
    background.lineStyle(2, 0x4cc6ff, 0.75);
    background.strokeRoundedRect(HUD_PANEL_X, HUD_PANEL_Y, HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT, 18);

    const header = this.add.text(HUD_PANEL_X + 20, HUD_PANEL_Y + 14, "Status do Herói", {
      fontSize: "18px",
      color: "#e3f6ff",
      fontFamily: "monospace"
    });
    header.setScrollFactor(0);
    header.setDepth(1001);
    header.setShadow(0, 2, "#061830", 0.8);

    const separator = this.add.rectangle(
      HUD_PANEL_X + HUD_PANEL_WIDTH / 2,
      HUD_PANEL_Y + 48,
      HUD_PANEL_WIDTH - 32,
      2,
      0x1b3a57,
      0.9
    );
    separator.setScrollFactor(0);
    separator.setDepth(1001);

    this.hudVitalsBar = this.add.graphics();
    this.hudVitalsBar.setScrollFactor(0);
    this.hudVitalsBar.setDepth(1001);
    this.hudVitalsBar.setPosition(HUD_PANEL_X + HUD_VITALS_OFFSET_X, HUD_PANEL_Y + HUD_VITALS_OFFSET_Y);

    this.hudVitalsText = this.add.text(0, 0, "", {
      fontSize: "12px",
      color: "#f5fdff",
      fontFamily: "monospace"
    });
    this.hudVitalsText.setScrollFactor(0);
    this.hudVitalsText.setDepth(1002);
    this.hudVitalsText.setOrigin(0.5, 0.5);
    this.hudVitalsText.setShadow(0, 1, "#0b263f", 0.75);

    this.hudStatsText = this.add.text(HUD_PANEL_X + 20, HUD_PANEL_Y + 100, "Conectando...", {
      fontSize: "14px",
      color: "#cde9ff",
      fontFamily: "monospace",
      lineSpacing: 6
    });
    this.hudStatsText.setScrollFactor(0);
    this.hudStatsText.setDepth(1001);

    this.drawHudVitals(0, 1);
    this.positionHudVitalsText(
      HUD_PANEL_X + HUD_VITALS_OFFSET_X,
      HUD_PANEL_Y + HUD_VITALS_OFFSET_Y,
      0,
      1
    );
  }

  private updateHud() {
    if (!this.localState) return;
    const { name, hp, maxHp, atk, xp, gold, equippedItemId, inventory } = this.localState;
    const inventoryText = inventory.join(", ") || "(vazio)";

    this.drawHudVitals(hp, maxHp);
    this.positionHudVitalsText(
      HUD_PANEL_X + HUD_VITALS_OFFSET_X,
      HUD_PANEL_Y + HUD_VITALS_OFFSET_Y,
      hp,
      maxHp
    );

    const statsLines = [
      `Jogador: ${name}`,
      `ATK: ${atk}`,
      `XP: ${xp} | Gold: ${gold}`,
      `Equipado: ${equippedItemId ?? "Nenhum"}`,
      `Inventário: ${inventoryText}`
    ];
    this.hudStatsText.setText(statsLines.join("\n"));
  }

  private drawHudVitals(current: number, max: number) {
    const ratio = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    this.hudVitalsBar.clear();
    this.hudVitalsBar.fillStyle(0x14263b, 0.95);
    this.hudVitalsBar.fillRoundedRect(0, 0, HUD_BAR_WIDTH, HUD_BAR_HEIGHT, 8);
    this.hudVitalsBar.lineStyle(1, 0x58d6ff, 0.85);
    this.hudVitalsBar.strokeRoundedRect(0, 0, HUD_BAR_WIDTH, HUD_BAR_HEIGHT, 8);

    if (ratio > 0) {
      const innerWidth = (HUD_BAR_WIDTH - 6) * ratio;
      this.hudVitalsBar.fillStyle(0x29e37f, 1);
      this.hudVitalsBar.fillRoundedRect(3, 3, innerWidth, HUD_BAR_HEIGHT - 6, 6);
    }
  }

  private positionHudVitalsText(x: number, y: number, current: number, max: number) {
    this.hudVitalsText.setPosition(x + HUD_BAR_WIDTH / 2, y + HUD_BAR_HEIGHT / 2);
    this.hudVitalsText.setText(`HP ${current}/${max}`);
  }

  private refreshMonsterUi(entity: MonsterEntity, forceRedraw = false) {
    const sprite = entity.sprite;
    this.updateEntityDepth(sprite);

    const top = sprite.y - sprite.displayHeight * sprite.originY;
    const barCenterY = top - 10;
    const centerX = sprite.x;
    const nameY = barCenterY - MONSTER_BAR_HEIGHT / 2 - 6;

    entity.nameLabel.setText(entity.type);
    entity.nameLabel.setPosition(centerX, nameY);
    entity.nameLabel.setDepth(sprite.depth + 2);

    this.positionMonsterHealthBar(entity.healthBar, centerX, barCenterY);
    entity.healthBar.setDepth(sprite.depth + 1);

    if (forceRedraw || entity.needsUiRefresh) {
      this.drawMonsterHealthBar(entity.healthBar, entity.currentHp, entity.maxHp);
      entity.healthText.setText(`${entity.currentHp}/${entity.maxHp}`);
      entity.needsUiRefresh = false;
    }

    entity.healthText.setPosition(centerX, barCenterY);
    entity.healthText.setDepth(sprite.depth + 2);
  }

  private positionMonsterHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number
  ) {
    graphics.setPosition(centerX - MONSTER_BAR_WIDTH / 2, centerY - MONSTER_BAR_HEIGHT / 2);
  }

  private drawMonsterHealthBar(graphics: Phaser.GameObjects.Graphics, current: number, max: number) {
    const ratio = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    graphics.clear();
    graphics.fillStyle(0x2c1216, 0.9);
    graphics.fillRoundedRect(0, 0, MONSTER_BAR_WIDTH, MONSTER_BAR_HEIGHT, 4);
    graphics.lineStyle(1, 0xff92a3, 0.85);
    graphics.strokeRoundedRect(0, 0, MONSTER_BAR_WIDTH, MONSTER_BAR_HEIGHT, 4);

    if (ratio > 0) {
      const innerWidth = (MONSTER_BAR_WIDTH - 4) * ratio;
      graphics.fillStyle(0xff4c61, 1);
      graphics.fillRoundedRect(2, 2, innerWidth, MONSTER_BAR_HEIGHT - 4, 3);
    }
  }

  private updatePlayerAnimation(player: PlayerState | null, entity: PlayerEntity, force = false) {
    const sprite = entity.sprite;
    const dir: Direction = player?.dir ?? entity.lastServerDir;
    if (player) {
      entity.lastServerDir = player.dir;
    }
    if (entity.isActionLocked && !force) {
      if (dir === "left") {
        sprite.setFlipX(true);
      } else if (dir === "right") {
        sprite.setFlipX(false);
      }
      return;
    }

    if (dir === "left") {
      sprite.setFlipX(true);
    } else if (dir === "right") {
      sprite.setFlipX(false);
    }

    if (dir !== "idle") {
      entity.lastDir = dir;
    }

    entity.lastServerDir = dir;

    const shouldRun = dir !== "idle";
    const nextKey = getAnimationKey(entity.classId, shouldRun ? "run" : "idle");
    if (force || entity.currentAnim !== nextKey) {
      if (force) {
        sprite.anims.play(nextKey);
      } else {
        sprite.anims.play(nextKey, true);
      }
      entity.currentAnim = nextKey;
    }
  }

  private triggerPlayerAction(
    playerId: string,
    action: "attack" | "pickup",
    dir?: Direction
  ) {
    const entity = this.playerEntities.get(playerId);
    if (!entity) {
      return;
    }

    const sprite = entity.sprite;
    if (entity.onActionComplete) {
      sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, entity.onActionComplete);
    }

    entity.isActionLocked = true;
    const animationKey = getAnimationKey(entity.classId, action);
    entity.currentAnim = animationKey;
    sprite.anims.play(animationKey);
    if (dir) {
      entity.lastServerDir = dir;
      if (dir !== "idle") {
        entity.lastDir = dir;
      }
    }
    if (action === "attack") {
      this.spawnAttackEffect(entity);
    }
    const callback = () => {
      entity.isActionLocked = false;
      entity.onActionComplete = undefined;
      const referenceState = playerId === getSessionId() ? this.localState ?? null : null;
      this.updatePlayerAnimation(referenceState, entity, true);
    };
    entity.onActionComplete = callback;
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, callback);
  }

  private spawnAttackEffect(entity: PlayerEntity) {
    const effect = getAttackEffectConfig(entity.classId);
    if (!effect) {
      return;
    }
    const direction = this.getEntityDirectionVector(entity);
    const sprite = entity.sprite;
    const startX = sprite.x + direction.x * 36;
    const startY = sprite.y - sprite.displayHeight * 0.5 + direction.y * 36;
    const projectile = this.add.image(startX, startY, effect.textureKey);
    projectile.setScale(effect.scale);
    projectile.setAlpha(0.9);
    projectile.setDepth(sprite.depth + 2);
    const targetX = startX + direction.x * effect.travelDistance;
    const targetY = startY + direction.y * effect.travelDistance;
    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      alpha: 0,
      duration: effect.lifespan,
      onComplete: () => {
        projectile.destroy();
      }
    });
  }

  private getEntityDirectionVector(entity: PlayerEntity) {
    let dir = entity.lastDir;
    if (dir === "idle") {
      dir = entity.sprite.flipX ? "left" : "right";
    }
    switch (dir) {
      case "left":
        return new Phaser.Math.Vector2(-1, 0);
      case "right":
        return new Phaser.Math.Vector2(1, 0);
      case "up":
        return new Phaser.Math.Vector2(0, -1);
      case "down":
        return new Phaser.Math.Vector2(0, 1);
      default:
        return new Phaser.Math.Vector2(1, 0);
    }
  }

  private syncState(snapshot: Snapshot) {
    const sessionId = getSessionId();

    // Players
    const existingIds = new Set(this.playerEntities.keys());
    Object.values(snapshot.players).forEach((player) => {
      let entity = this.playerEntities.get(player.id);
      if (!entity) {
        const textureKey = getCharacterTextureKey(player.classId);
        const sprite = this.add.sprite(player.x, player.y, textureKey);
        sprite.setScale(0.4);
        sprite.setOrigin(0.5, 0.88);
        const idleKey = getAnimationKey(player.classId, "idle");
        sprite.anims.play(idleKey);
        this.updateEntityDepth(sprite);
        const label = this.add
          .text(player.x, player.y, player.name, {
            fontSize: "14px",
            color: "#ffffff",
            fontFamily: "monospace"
          })
          .setOrigin(0.5, 1);
        label.setDepth(sprite.depth + 1);
        this.positionLabel(label, sprite);
        entity = {
          sprite,
          label,
          targetX: player.x,
          targetY: player.y,
          currentAnim: idleKey,
          isActionLocked: false,
          classId: player.classId,
          lastDir: player.dir !== "idle" ? player.dir : "down",
          lastServerDir: player.dir
        };
        this.playerEntities.set(player.id, entity);
      }
      if (entity.classId !== player.classId) {
        entity.classId = player.classId;
        const textureKey = getCharacterTextureKey(player.classId);
        entity.sprite.setTexture(textureKey);
        entity.currentAnim = "";
        this.updatePlayerAnimation(player, entity, true);
      }
      entity.targetX = player.x;
      entity.targetY = player.y;
      entity.label.setText(player.name);
      this.updateEntityDepth(entity.sprite);
      entity.label.setDepth(entity.sprite.depth + 1);
      this.positionLabel(entity.label, entity.sprite);
      if (player.id === sessionId) {
        this.localState = player;
        this.cameras.main.startFollow(entity.sprite, false, 0.08, 0.08);
      }
      if (player.dir !== "idle") {
        entity.lastDir = player.dir;
      }
      entity.lastServerDir = player.dir;
      this.updatePlayerAnimation(player, entity);
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
        sprite.setScale(0.35);
        sprite.setOrigin(0.5, 0.88);
        this.updateEntityDepth(sprite);
        const nameLabel = this.add
          .text(monster.x, monster.y, monster.type, {
            fontSize: "12px",
            color: "#ffdede",
            fontFamily: "monospace"
          })
          .setOrigin(0.5, 1);
        nameLabel.setShadow(0, 1, "#29060b", 0.85);

        const healthBar = this.add.graphics();
        const healthText = this.add.text(monster.x, monster.y, "", {
          fontSize: "10px",
          color: "#ffe5e8",
          fontFamily: "monospace"
        });
        healthText.setOrigin(0.5, 0.5);
        healthText.setShadow(0, 1, "#29060b", 0.8);

        entity = {
          sprite,
          nameLabel,
          healthBar,
          healthText,
          currentHp: monster.hp,
          maxHp: monster.maxHp,
          type: monster.type,
          needsUiRefresh: true
        };
        this.monsterEntities.set(monster.id, entity);
      }
      entity.sprite.setPosition(monster.x, monster.y);
      if (
        entity.currentHp !== monster.hp ||
        entity.maxHp !== monster.maxHp ||
        entity.type !== monster.type
      ) {
        entity.currentHp = monster.hp;
        entity.maxHp = monster.maxHp;
        entity.type = monster.type;
        entity.needsUiRefresh = true;
      }
      this.refreshMonsterUi(entity, entity.needsUiRefresh);
      monsterIds.delete(monster.id);
    });
    monsterIds.forEach((id) => {
      const entity = this.monsterEntities.get(id);
      entity?.sprite.destroy();
      entity?.nameLabel.destroy();
      entity?.healthBar.destroy();
      entity?.healthText.destroy();
      this.monsterEntities.delete(id);
    });

    // Drops
    this.pendingDrops = snapshot.drops;
    const dropIds = new Set(this.dropEntities.keys());
    Object.values(snapshot.drops).forEach((drop) => {
      let entity = this.dropEntities.get(drop.id);
      if (!entity) {
        const sprite = this.add.image(drop.x, drop.y, "drop");
        sprite.setScale(0.32);
        sprite.setOrigin(0.5, 0.9);
        this.updateEntityDepth(sprite, -5);
        entity = { sprite };
        this.dropEntities.set(drop.id, entity);
      } else {
        entity.sprite.setPosition(drop.x, drop.y);
      }
      this.updateEntityDepth(entity.sprite, -5);
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

  private updateEntityDepth(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, offset = 0) {
    sprite.setDepth(sprite.y + offset);
  }

  private positionLabel(
    label: Phaser.GameObjects.Text,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    padding = 12
  ) {
    const top = sprite.y - sprite.displayHeight * sprite.originY;
    label.setPosition(sprite.x, top - padding);
  }
}
