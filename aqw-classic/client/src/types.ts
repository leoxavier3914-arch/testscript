export type Direction = "up" | "down" | "left" | "right" | "idle";
export type PlayerClassId = "swordsman" | "mage";

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  dir: Direction;
  classId: PlayerClassId;
  hp: number;
  maxHp: number;
  atk: number;
  equippedItemId?: string;
  inventory: string[];
  xp: number;
  gold: number;
}

export interface MonsterState {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  slot: "weapon" | "armor" | "misc";
  atkBonus?: number;
}

export interface DropState {
  id: string;
  itemId: string;
  x: number;
  y: number;
}

export interface Snapshot {
  players: Record<string, PlayerState>;
  monsters: Record<string, MonsterState>;
  drops: Record<string, DropState>;
}
