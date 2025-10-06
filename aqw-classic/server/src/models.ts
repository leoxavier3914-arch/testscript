export type Direction = "up" | "down" | "left" | "right" | "idle";
export type PlayerClassId = "swordsman" | "mage";

export interface Item {
  id: string;
  name: string;
  slot: "weapon" | "armor" | "misc";
  atkBonus?: number;
}

export interface InventoryEntry {
  itemId: string;
}

export interface PlayerModel {
  id: string;
  name: string;
  x: number;
  y: number;
  dir: Direction;
  classId: PlayerClassId;
  hp: number;
  maxHp: number;
  atk: number;
  baseAtk: number;
  equippedItemId?: string;
  inventory: string[];
  xp: number;
  gold: number;
  attackCooldownUntil: number;
  moveIntent: { x: number; y: number };
}

export interface MonsterModel {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  patrol: { x: number; y: number }[];
  patrolIndex: number;
  respawnAt?: number;
}

export interface DropModel {
  id: string;
  itemId: string;
  x: number;
  y: number;
  expiresAt: number;
}
