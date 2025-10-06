import { MapSchema, Schema, type } from "@colyseus/schema";
import type { PlayerClassId } from "../../models";

export class PlayerState extends Schema {
  @type("string")
  id!: string;
  @type("string")
  name!: string;
  @type("number")
  x = 0;
  @type("number")
  y = 0;
  @type("string")
  dir: string = "idle";
  @type("string")
  classId: PlayerClassId = "swordsman";
  @type("number")
  hp = 100;
  @type("number")
  maxHp = 100;
  @type("number")
  atk = 5;
  @type("string")
  equippedItemId?: string;
  @type(["string"])
  inventory: string[] = [];
  @type("number")
  xp = 0;
  @type("number")
  gold = 0;
}

export class MonsterState extends Schema {
  @type("string")
  id!: string;
  @type("string")
  type!: string;
  @type("number")
  x = 0;
  @type("number")
  y = 0;
  @type("number")
  hp = 0;
  @type("number")
  maxHp = 0;
}

export class DropState extends Schema {
  @type("string")
  id!: string;
  @type("string")
  itemId!: string;
  @type("number")
  x = 0;
  @type("number")
  y = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  @type({ map: MonsterState })
  monsters = new MapSchema<MonsterState>();

  @type({ map: DropState })
  drops = new MapSchema<DropState>();
}
