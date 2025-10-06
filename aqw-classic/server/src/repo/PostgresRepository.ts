import type { PlayerProfile, Repository } from "./Repository";

/**
 * TODO: implementar repositório real usando PostgreSQL.
 * Sugestão: usar pg ou Prisma e mover lógica de mapeamento aqui.
 * O GameRoom só deve depender da interface Repository.
 */
export class PostgresRepository implements Repository {
  async getOrCreatePlayer(name: string): Promise<PlayerProfile> {
    throw new Error("PostgresRepository ainda não implementado");
  }

  async savePlayer(profile: PlayerProfile): Promise<void> {
    throw new Error("PostgresRepository ainda não implementado");
  }
}

export default PostgresRepository;
