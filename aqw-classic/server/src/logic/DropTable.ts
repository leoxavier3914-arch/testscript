export interface DropTableEntry {
  itemId: string;
  chance: number;
  ttlMs: number;
}

export const DEFAULT_DROP_TABLE: DropTableEntry[] = [
  { itemId: "wooden_sword", chance: 0.25, ttlMs: 15000 }
];
