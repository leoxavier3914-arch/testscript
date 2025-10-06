import { randomUUID } from "crypto";
import type { PlayerProfile, Repository } from "./Repository";

export class InMemoryRepository implements Repository {
  private players = new Map<string, PlayerProfile>();

  async getOrCreatePlayer(name: string): Promise<PlayerProfile> {
    let profile = this.players.get(name.toLowerCase());
    if (!profile) {
      profile = {
        id: randomUUID(),
        name,
        classId: "swordsman",
        xp: 0,
        gold: 0,
        inventory: [],
        equippedItemId: undefined
      };
      this.players.set(name.toLowerCase(), profile);
    }
    return { ...profile, inventory: [...profile.inventory] };
  }

  async savePlayer(profile: PlayerProfile): Promise<void> {
    this.players.set(profile.name.toLowerCase(), { ...profile, inventory: [...profile.inventory] });
  }
}

export default InMemoryRepository;
