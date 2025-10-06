import type { PlayerModel } from "../models";

export const WORLD_BOUNDS = { width: 1920, height: 1080 };
export const MAX_SPEED = 180; // px/s

export function updatePlayerPosition(player: PlayerModel, deltaSeconds: number) {
  const vx = clamp(player.moveIntent.x, -1, 1) * MAX_SPEED;
  const vy = clamp(player.moveIntent.y, -1, 1) * MAX_SPEED;
  const newX = clamp(player.x + vx * deltaSeconds, 0, WORLD_BOUNDS.width);
  const newY = clamp(player.y + vy * deltaSeconds, 0, WORLD_BOUNDS.height);
  player.x = newX;
  player.y = newY;
  player.dir = resolveDirection(vx, vy);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveDirection(vx: number, vy: number) {
  if (Math.abs(vx) < 1 && Math.abs(vy) < 1) {
    return "idle" as const;
  }
  if (Math.abs(vx) > Math.abs(vy)) {
    return vx > 0 ? "right" : "left";
  }
  return vy > 0 ? "down" : "up";
}
