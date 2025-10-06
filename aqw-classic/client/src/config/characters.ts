import type { PlayerClassId } from "../types";

export interface CharacterClassDefinition {
  id: PlayerClassId;
  textureKey: string;
  assetPath: string;
  displayName: string;
  attackEffect?: {
    textureKey: string;
    assetPath: string;
    scale: number;
    travelDistance: number;
    lifespan: number;
  };
}

export const CHARACTER_CLASSES: Record<PlayerClassId, CharacterClassDefinition> = {
  swordsman: {
    id: "swordsman",
    textureKey: "swordsman",
    assetPath: "char.png",
    displayName: "Espadachim"
  },
  mage: {
    id: "mage",
    textureKey: "mage",
    assetPath: "mage.png",
    displayName: "Mago",
    attackEffect: {
      textureKey: "mage-projectile",
      assetPath: "mage-projectile.png",
      scale: 0.48,
      travelDistance: 320,
      lifespan: 420
    }
  }
} as const;

export const REQUIRED_CHARACTER_ASSETS = [
  {
    file: "char.png",
    description: "Spritesheet 8x4 do espadachim (256px por quadro)",
    publicPath: "/assets/char.png"
  },
  {
    file: "mage.png",
    description: "Spritesheet 8x4 do mago (256px por quadro)",
    publicPath: "/assets/mage.png"
  },
  {
    file: "mage-projectile.png",
    description: "Sprite da magia disparada pelo mago",
    publicPath: "/assets/mage-projectile.png"
  }
] as const;

export const CHARACTER_ANIMATIONS = ["idle", "run", "attack", "pickup"] as const;
export type CharacterAnimation = (typeof CHARACTER_ANIMATIONS)[number];

export const PLAYER_SPRITE_CONFIG = {
  frameWidth: 256,
  frameHeight: 256,
  columns: 8
} as const;

export const CHARACTER_ANIMATION_PRESETS: Record<CharacterAnimation, { row: number; frameRate: number; repeat: number }> = {
  idle: { row: 0, frameRate: 6, repeat: -1 },
  run: { row: 1, frameRate: 12, repeat: -1 },
  attack: { row: 2, frameRate: 14, repeat: 0 },
  pickup: { row: 3, frameRate: 10, repeat: 0 }
};

export const getCharacterTextureKey = (classId: PlayerClassId) =>
  CHARACTER_CLASSES[classId].textureKey;

export const getAnimationKey = (classId: PlayerClassId, animation: CharacterAnimation) =>
  `${classId}-${animation}`;

export const getAttackEffectConfig = (classId: PlayerClassId) =>
  CHARACTER_CLASSES[classId].attackEffect;
