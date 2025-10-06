# AQW Classic MMO MVP

Protótipo multiplayer inspirado em AQWorlds clássico: cliente em Phaser 3 + Vite, servidor autoritativo em Colyseus. O objetivo é demonstrar movimentação básica, combate PvE, drops e inventário em um hub compartilhado.

## Pré-requisitos

- Node.js 18+
- npm 9+

## Instalação

```bash
cd aqw-classic
npm run install:all
```

## Execução

Abra dois terminais:

1. **Servidor (porta 2567):**
   ```bash
   cd aqw-classic
   npm run dev:server
   ```
   O servidor lê variáveis de ambiente de `.env` (use `.env.example` como base) e restringe CORS a `http://localhost:5173`.

2. **Cliente (porta 5173):**
   ```bash
   cd aqw-classic
   npm run dev:client
   ```

Abra `http://localhost:5173` em 2–3 abas do navegador desktop para testar a sincronização.

## Controles e comandos

- **Movimento:** WASD ou setas.
- **Atacar:** Barra de espaço (cooldown 0,8s; o servidor valida alcance e dano).
- **Interagir:** `E` coleta o drop mais próximo.
- **Chat local:** digite mensagem no chat (máx. 1 msg/s por jogador).
- **Comandos de chat:**
  - `/join hub` ou `/join forest` para trocar de mapa (cria/entra em sala com mesmo layout).
  - `/equip <itemId>` para equipar item do inventário (ex.: `wooden_sword`).
  - `/unequip` remove o item equipado.

## Ajustes rápidos

Todas as constantes críticas ficam no servidor:

- `src/logic/Movement.ts`: velocidade máxima e limites do mundo.
- `src/logic/Combat.ts`: alcance, cooldown, XP/gold por kill.
- `src/logic/DropTable.ts`: chances de drop e tempo de vida do loot.
- `src/rooms/GameRoom.ts`: configuração dos mapas (`MAP_CONFIG`), spawn de monstros e balanceamento base.

## Estrutura de pastas

```
aqw-classic/
  package.json
  README.md
  client/
    package.json
    index.html
    vite.config.ts
    tsconfig.json
    src/
      main.ts
      phaserGame.ts
      types.ts
      net/connection.ts
      scenes/BootScene.ts
      scenes/HubScene.ts
      ui/ChatUI.ts
    public/
      assets/
        kenney/
          (adicione aqui os PNGs extraídos do pack Kenney Isometric Miniature Dungeon)
  server/
    package.json
    tsconfig.json
    .env.example
    src/
      index.ts
      models.ts
      logic/
        Movement.ts
        Combat.ts
        DropTable.ts
      rooms/
        GameRoom.ts
        schemas/GameState.ts
      repo/
        Repository.ts
        InMemoryRepository.ts
        PostgresRepository.ts
      utils/RateLimiter.ts
```

## Extensões futuras

Comentários in-line destacam pontos de ampliação. Recomendações gerais:

- **Novos mapas:** duplique entradas em `MAP_CONFIG` (GameRoom) definindo spawn, monstros e patrulhas. O comando `/join` aceitará automaticamente o novo nome.
- **Persistência real:** implemente `PostgresRepository` usando `pg` ou Prisma e injete-o no `GameRoom` (ex.: via `gameServer.define("game", GameRoom, { repository: new PostgresRepository() })`).
- **Login completo:** substitua o prompt simples integrando um serviço como Supabase; após autenticar, preencha o perfil do jogador antes de chamar `client.joinOrCreate`.

## Notas de implementação

- O servidor é autoritativo: o cliente envia apenas intenções (`move`, `attack`, `pickup` etc.) validadas por Zod.
- Interpolação no cliente suaviza o movimento dos outros jogadores.
- Antispam: `RateLimiter` aplicado a chat e entradas de movimento/ataque.
- Arte do cliente carrega sprites do pack Kenney Isometric Miniature Dungeon.

## Arte

Os sprites vivem em `client/src/assets/`. Para substituir por arte própria, mantenha os nomes dos arquivos e respeite as dimensões/grades descritas abaixo.

- **Personagem principal (`char.png`)** – sprite sheet de 12 quadros distribuídos em uma grade 4×3. Cada quadro tem o mesmo tamanho. As animações usam os seguintes índices (contando da esquerda para a direita e de cima para baixo):
  - `0` → idle.
  - `0,1,2` → corrida (loop).
  - `3,4,5,6` → ataque (toca uma vez).
  - `7,8,9,10,11` → animação de coleta (toca uma vez).
  Ajuste a largura/altura do quadro em `BootScene.preload` (`frameWidth`/`frameHeight`) caso utilize um spritesheet com dimensões diferentes de 256×256 px.
- **Itens dropados (`drop.png`)** – ícone estático exibido quando um loot cai no chão.
- **Monstro (`monster.png`)** – sprite estático do slime inimigo do hub.
- **Chão (`ground-tile.png`)** – tile isométrico usado para preencher o piso. Use um PNG quadrado/losangular pensado para repetição. Gere o arquivo copiando `Isometric/stoneTile_S.png` (do pack Kenney Isometric Miniature Dungeon) para `client/src/assets/ground-tile.png`.

O diretório `client/public/assets/kenney` já contém `LICENSE.txt` e `README.txt` originais do pack Kenney; mantenha-os ao lado dos sprites se importar novos arquivos.

### Versionando PNGs

1. Coloque os arquivos dentro de `aqw-classic/client/src/assets/`.
2. Rode `git status` para confirmar que o PNG aparece como "untracked" ou "modified".
3. Adicione-o ao repositório com `git add caminho/do/arquivo.png`.
4. Faça o commit normalmente (`git commit -m "Atualiza sprite"`).

> **Dica:** não há bloqueio para binários; se o PNG não aparecer no `git status`, verifique se o nome foi escrito corretamente e se não existe nenhuma entrada em `.gitignore` correspondendo ao caminho.
