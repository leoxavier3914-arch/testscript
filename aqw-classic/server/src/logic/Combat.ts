import { randomUUID } from "crypto";
import type { DropModel, MonsterModel, PlayerModel } from "../models";
import type { DropTableEntry } from "./DropTable";

export const ATTACK_COOLDOWN_MS = 800;
export const ATTACK_RANGE = 72;
export const BASE_XP_REWARD = 10;
export const BASE_GOLD_REWARD = 5;

export function tryAttackMonster(
  player: PlayerModel,
  monsters: Map<string, MonsterModel>,
  now: number
): MonsterModel | null {
  if (now < player.attackCooldownUntil) {
    return null;
  }
  player.attackCooldownUntil = now + ATTACK_COOLDOWN_MS;
  let target: MonsterModel | null = null;
  monsters.forEach((monster) => {
    if (monster.hp <= 0) return;
    const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
    if (dist <= ATTACK_RANGE && !target) {
      target = monster;
    }
  });
  if (!target) {
    return null;
  }
  const damage = Math.max(1, player.atk);
  target.hp = Math.max(0, target.hp - damage);
  return target;
}

export function handleMonsterDeath(
  player: PlayerModel,
  monster: MonsterModel,
  dropTable: DropTableEntry[],
  drops: Map<string, DropModel>,
  now: number
) {
  player.xp += BASE_XP_REWARD;
  player.gold += BASE_GOLD_REWARD;
  monster.respawnAt = now + 5000;
  spawnDrop(monster, dropTable, drops, now);
}

function spawnDrop(
  monster: MonsterModel,
  dropTable: DropTableEntry[],
  drops: Map<string, DropModel>,
  now: number
) {
  dropTable.forEach((entry) => {
    if (Math.random() <= entry.chance) {
      const drop: DropModel = {
        id: randomUUID(),
        itemId: entry.itemId,
        x: monster.x,
        y: monster.y,
        expiresAt: now + entry.ttlMs
      };
      drops.set(drop.id, drop);
    }
  });
}
