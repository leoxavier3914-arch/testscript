export interface PlayerProfile {
  id: string;
  name: string;
  xp: number;
  gold: number;
  inventory: string[];
  equippedItemId?: string;
}

export interface Repository {
  getOrCreatePlayer(name: string): Promise<PlayerProfile>;
  savePlayer(profile: PlayerProfile): Promise<void>;
}
