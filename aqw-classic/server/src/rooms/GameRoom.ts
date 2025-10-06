import { Client, Room } from "colyseus";
import { z } from "zod";
import { GameState, PlayerState, MonsterState, DropState } from "./schemas/GameState";
import { ATTACK_RANGE, handleMonsterDeath, tryAttackMonster } from "../logic/Combat";
import { DEFAULT_DROP_TABLE } from "../logic/DropTable";
import { updatePlayerPosition } from "../logic/Movement";
import type { DropModel, MonsterModel, PlayerModel } from "../models";
import InMemoryRepository from "../repo/InMemoryRepository";
import type { PlayerProfile, Repository } from "../repo/Repository";
import RateLimiter from "../utils/RateLimiter";

interface GameRoomOptions {
  map?: string;
  repository?: Repository;
}

// Mantém os itens disponíveis no MVP. Para adicionar novos itens, inclua aqui e atualize as tabelas de drop.
const ITEMS: Record<string, { id: string; name: string; slot: "weapon" | "armor" | "misc"; atkBonus?: number }> = {
  wooden_sword: { id: "wooden_sword", name: "Wooden Sword", slot: "weapon", atkBonus: 1 }
};

// Configuração mínima dos mapas/instâncias. Amplie aqui para adicionar novos cenários.
const MAP_CONFIG: Record<
  string,
  {
    spawn: { x: number; y: number };
    patrols: { path: { x: number; y: number }[]; type: string; maxHp: number }[];
  }
> = {
  hub: {
    spawn: { x: 960, y: 540 },
    patrols: [
      {
        type: "Training Dummy",
        maxHp: 40,
        path: [
          { x: 900, y: 520 },
          { x: 1020, y: 520 },
          { x: 1020, y: 600 },
          { x: 900, y: 600 }
        ]
      }
    ]
  },
  forest: {
    spawn: { x: 600, y: 400 },
    patrols: [
      {
        type: "Forest Slime",
        maxHp: 60,
        path: [
          { x: 500, y: 360 },
          { x: 720, y: 360 },
          { x: 720, y: 520 },
          { x: 500, y: 520 }
        ]
      }
    ]
  }
};

const moveSchema = z.object({
  x: z.number().finite().min(-1).max(1),
  y: z.number().finite().min(-1).max(1)
});

const chatSchema = z.object({
  text: z.string().min(1).max(200)
});

const joinSchema = z.object({
  map: z.string().min(2).max(24)
});

const pickupSchema = z.object({
  dropId: z.string().uuid()
});

const equipSchema = z.object({
  itemId: z.string().min(1)
});

export class GameRoom extends Room<GameState> {
  static override filterBy = ["map"];

  // Pode ser substituído por PostgresRepository posteriormente (ver README para detalhes).
  private repository: Repository;
  private players = new Map<string, PlayerModel>();
  private monsters = new Map<string, MonsterModel>();
  private drops = new Map<string, DropModel>();
  private mapName = "hub";
  private chatLimiter = new RateLimiter(1000);
  private moveLimiter = new RateLimiter(60);

  constructor() {
    super();
    this.repository = new InMemoryRepository();
  }

  onCreate(options: GameRoomOptions) {
    this.mapName = options.map && MAP_CONFIG[options.map] ? options.map : "hub";
    this.repository = options.repository ?? this.repository;
    this.maxClients = 20;
    this.setState(new GameState());
    this.setMetadata({ map: this.mapName });
    this.spawnMonsters();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("attack", (client) => this.handleAttack(client));
    this.onMessage("chat", (client, payload) => this.handleChat(client, payload));
    this.onMessage("join", (client, payload) => this.handleJoinCommand(client, payload));
    this.onMessage("pickup", (client, payload) => this.handlePickup(client, payload));
    this.onMessage("equip", (client, payload) => this.handleEquip(client, payload));
    this.onMessage("unequip", (client) => this.handleUnequip(client));
  }

  async onAuth(_client: Client, options: { name?: string }) {
    const name = this.validateNickname(options.name ?? "Hero");
    const profile = await this.repository.getOrCreatePlayer(name);
    return profile;
  }

  async onJoin(client: Client, options: { name?: string }, auth: PlayerProfile) {
    const spawnPoint = MAP_CONFIG[this.mapName].spawn;
    const player: PlayerModel = {
      id: client.sessionId,
      name: auth.name,
      x: spawnPoint.x,
      y: spawnPoint.y,
      dir: "down",
      hp: 100,
      maxHp: 100,
      atk: 5 + (auth.equippedItemId ? ITEMS[auth.equippedItemId]?.atkBonus ?? 0 : 0),
      baseAtk: 5,
      equippedItemId: auth.equippedItemId,
      inventory: [...auth.inventory],
      xp: auth.xp,
      gold: auth.gold,
      attackCooldownUntil: 0,
      moveIntent: { x: 0, y: 0 }
    };
    this.players.set(client.sessionId, player);

    const playerState = new PlayerState();
    this.state.players.set(client.sessionId, playerState);
    this.syncPlayerState(player);
    this.broadcast("chat", { from: "SYSTEM", text: `${player.name} entrou em ${this.mapName}` });
  }

  async onLeave(client: Client, _consented: boolean) {
    const player = this.players.get(client.sessionId);
    if (player) {
      await this.repository.savePlayer({
        id: player.id,
        name: player.name,
        xp: player.xp,
        gold: player.gold,
        inventory: [...player.inventory],
        equippedItemId: player.equippedItemId
      });
      this.players.delete(client.sessionId);
      this.state.players.delete(client.sessionId);
      this.broadcast("chat", { from: "SYSTEM", text: `${player.name} saiu.` });
    }
  }

  private update(deltaTime: number) {
    const deltaSeconds = deltaTime / 1000;
    const now = Date.now();

    this.players.forEach((player, id) => {
      updatePlayerPosition(player, deltaSeconds);
      this.syncPlayerState(player);
    });

    this.updateMonsters(deltaSeconds, now);
    this.syncDrops(now);
  }

  private syncPlayerState(player: PlayerModel) {
    const state = this.state.players.get(player.id);
    if (!state) return;
    state.id = player.id;
    state.name = player.name;
    state.x = player.x;
    state.y = player.y;
    state.dir = player.dir;
    state.hp = player.hp;
    state.maxHp = player.maxHp;
    state.atk = player.atk;
    state.equippedItemId = player.equippedItemId;
    state.inventory = [...player.inventory];
    state.xp = player.xp;
    state.gold = player.gold;
  }

  private spawnMonsters() {
    this.monsters.clear();
    this.state.monsters.clear();
    const config = MAP_CONFIG[this.mapName];
    config.patrols.forEach((patrol, index) => {
      const monster: MonsterModel = {
        id: `${this.mapName}-mob-${index}`,
        type: patrol.type,
        x: patrol.path[0].x,
        y: patrol.path[0].y,
        hp: patrol.maxHp,
        maxHp: patrol.maxHp,
        patrol: patrol.path,
        patrolIndex: 0
      };
      this.monsters.set(monster.id, monster);
      const monsterState = new MonsterState();
      this.state.monsters.set(monster.id, monsterState);
      this.syncMonsterState(monster);
    });
  }

  private updateMonsters(deltaSeconds: number, now: number) {
    const speed = 60;
    this.monsters.forEach((monster) => {
      if (monster.hp <= 0) {
        if (monster.respawnAt && now >= monster.respawnAt) {
          monster.hp = monster.maxHp;
          monster.respawnAt = undefined;
        } else {
          return;
        }
      }
      const target = monster.patrol[(monster.patrolIndex + 1) % monster.patrol.length];
      const dist = Math.hypot(target.x - monster.x, target.y - monster.y);
      if (dist < 4) {
        monster.patrolIndex = (monster.patrolIndex + 1) % monster.patrol.length;
      } else {
        const dirX = (target.x - monster.x) / dist;
        const dirY = (target.y - monster.y) / dist;
        monster.x += dirX * speed * deltaSeconds;
        monster.y += dirY * speed * deltaSeconds;
      }
      this.syncMonsterState(monster);
    });
  }

  private syncMonsterState(monster: MonsterModel) {
    const state = this.state.monsters.get(monster.id);
    if (!state) return;
    state.id = monster.id;
    state.type = monster.type;
    state.x = monster.x;
    state.y = monster.y;
    state.hp = monster.hp;
    state.maxHp = monster.maxHp;
  }

  private syncDrops(now: number) {
    this.drops.forEach((drop, id) => {
      if (drop.expiresAt <= now) {
        this.drops.delete(id);
        this.state.drops.delete(id);
      }
    });
    this.drops.forEach((drop) => {
      let state = this.state.drops.get(drop.id);
      if (!state) {
        state = new DropState();
        this.state.drops.set(drop.id, state);
      }
      state.id = drop.id;
      state.itemId = drop.itemId;
      state.x = drop.x;
      state.y = drop.y;
    });
  }

  private handleMove(client: Client, payload: unknown) {
    const parsed = moveSchema.safeParse(payload);
    if (!parsed.success) return;
    const player = this.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    if (!this.moveLimiter.tryConsume(client.sessionId, now)) {
      return;
    }
    player.moveIntent = parsed.data;
  }

  private handleAttack(client: Client) {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    const monster = tryAttackMonster(player, this.monsters, now);
    if (monster) {
      if (monster.hp <= 0) {
        handleMonsterDeath(player, monster, DEFAULT_DROP_TABLE, this.drops, now);
        this.broadcast("chat", {
          from: "SYSTEM",
          text: `${player.name} derrotou ${monster.type}! Recompensa distribuída.`
        });
      }
      this.syncMonsterState(monster);
      this.syncPlayerState(player);
    }
  }

  private handleChat(client: Client, payload: unknown) {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    const parsed = chatSchema.safeParse(payload);
    if (!parsed.success) return;
    const now = Date.now();
    if (!this.chatLimiter.tryConsume(client.sessionId, now)) {
      return;
    }
    const text = parsed.data.text.trim();
    if (!text) return;
    this.broadcast("chat", { from: player.name, text });
  }

  private handleJoinCommand(client: Client, payload: unknown) {
    const parsed = joinSchema.safeParse(payload);
    if (!parsed.success) return;
    const map = parsed.data.map.toLowerCase();
    if (!MAP_CONFIG[map]) {
      client.send("error", `Mapa ${map} não existe.`);
      return;
    }
    client.send("switch_map", { map });
  }

  private handlePickup(client: Client, payload: unknown) {
    const parsed = pickupSchema.safeParse(payload);
    if (!parsed.success) return;
    const player = this.players.get(client.sessionId);
    if (!player) return;
    const drop = this.drops.get(parsed.data.dropId);
    if (!drop) return;
    if (player.inventory.length >= 20) {
      client.send("error", "Inventário cheio.");
      return;
    }
    const dist = Math.hypot(drop.x - player.x, drop.y - player.y);
    if (dist > ATTACK_RANGE) {
      return;
    }
    player.inventory.push(drop.itemId);
    this.drops.delete(drop.id);
    this.state.drops.delete(drop.id);
    this.syncPlayerState(player);
    client.send("chat", { from: "SYSTEM", text: `Pegou ${drop.itemId}` });
  }

  private handleEquip(client: Client, payload: unknown) {
    const parsed = equipSchema.safeParse(payload);
    if (!parsed.success) return;
    const player = this.players.get(client.sessionId);
    if (!player) return;
    const itemId = parsed.data.itemId;
    if (!player.inventory.includes(itemId)) {
      client.send("error", "Item não encontrado no inventário.");
      return;
    }
    const item = ITEMS[itemId];
    if (!item) {
      client.send("error", "Item desconhecido.");
      return;
    }
    player.equippedItemId = itemId;
    player.atk = player.baseAtk + (item.atkBonus ?? 0);
    this.syncPlayerState(player);
  }

  private handleUnequip(client: Client) {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    player.equippedItemId = undefined;
    player.atk = player.baseAtk;
    this.syncPlayerState(player);
  }

  private validateNickname(name: string) {
    const safe = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
    if (safe.length < 3) return "Hero";
    return safe;
  }
}

export default GameRoom;
