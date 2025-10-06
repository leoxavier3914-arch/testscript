import { Client, Room } from "colyseus.js";
import type { Direction, PlayerClassId, Snapshot } from "../types";

type ConnectionEventMap = {
  state: Snapshot;
  chat: { from: string; text: string };
  joined: { sessionId: string; map: string };
  error: string;
  playerAttack: { playerId: string; dir: Direction };
};

type Handler<T> = (payload: T) => void;

const listeners: { [K in keyof ConnectionEventMap]?: Set<Handler<ConnectionEventMap[K]>> } = {};

const emit = <K extends keyof ConnectionEventMap>(event: K, payload: ConnectionEventMap[K]) => {
  listeners[event]?.forEach((handler) => handler(payload));
};

export const on = <K extends keyof ConnectionEventMap>(event: K, handler: Handler<ConnectionEventMap[K]>) => {
  if (!listeners[event]) {
    listeners[event] = new Set();
  }
  listeners[event]!.add(handler);
  return () => listeners[event]!.delete(handler);
};

let room: Room | null = null;
let sessionId: string | null = null;
let currentMap = "hub";
let playerName = "Hero";
let playerClassId: PlayerClassId = "swordsman";
let colyseusClient: Client | null = null;
let roomResolver: ((room: Room) => void) | null = null;
let roomRejecter: ((reason?: unknown) => void) | null = null;

const AVAILABLE_CLASSES: PlayerClassId[] = ["swordsman", "mage"];
const CLASS_STORAGE_KEY = "aqw-classic:player-class";

const normalizeClassId = (raw?: string | null): PlayerClassId | null => {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return AVAILABLE_CLASSES.includes(normalized as PlayerClassId)
    ? (normalized as PlayerClassId)
    : null;
};

const readStoredClass = (): PlayerClassId => {
  try {
    const stored = window.localStorage.getItem(CLASS_STORAGE_KEY);
    return normalizeClassId(stored) ?? "swordsman";
  } catch {
    return "swordsman";
  }
};

const storeClass = (classId: PlayerClassId) => {
  try {
    window.localStorage.setItem(CLASS_STORAGE_KEY, classId);
  } catch {
    /* ignore */
  }
};

const promptForClass = (defaultClass: PlayerClassId): PlayerClassId => {
  const options = AVAILABLE_CLASSES.join("/");
  const input = prompt(`Escolha uma classe (${options}):`, defaultClass) ?? defaultClass;
  return normalizeClassId(input) ?? defaultClass;
};

const roomReady = new Promise<Room>((resolve, reject) => {
  roomResolver = resolve;
  roomRejecter = reject;
  void connectInternal();
});

// Responsável por (re)entrar na sala apropriada, inclusive quando o servidor pede /join.
async function connectInternal(map: string = currentMap) {
  try {
    if (!colyseusClient) {
      const nickname = prompt("Escolha um nickname (3-16 alfanumérico):", "Hero") || "Hero";
      playerName = sanitizeNickname(nickname);
      colyseusClient = new Client(import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567");
      playerClassId = promptForClass(readStoredClass());
      storeClass(playerClassId);
    }
    await joinRoom(map);
  } catch (error) {
    emit("error", (error as Error)?.message ?? "Unknown error");
    roomRejecter?.(error);
  }
}

function sanitizeNickname(raw: string) {
  return (raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || "Hero").padEnd(3, "0");
}

async function joinRoom(map: string) {
  if (!colyseusClient) {
    throw new Error("Client not initialized");
  }
  if (room) {
    room.removeAllListeners();
    await room.leave();
  }
  currentMap = map;
  room = await colyseusClient.joinOrCreate("game", { name: playerName, map: currentMap, classId: playerClassId });
  sessionId = room.sessionId;
  registerRoomHandlers(room);
  emit("joined", { sessionId, map: currentMap });
  roomResolver?.(room);
}

function registerRoomHandlers(activeRoom: Room) {
  activeRoom.onLeave((code) => {
    console.warn("Disconnected from server", code);
  });

  activeRoom.onStateChange((state) => {
    emit("state", state.toJSON());
  });

  activeRoom.onMessage("chat", (message: { from: string; text: string }) => {
    emit("chat", message);
  });

  activeRoom.onMessage("error", (message: string) => {
    emit("error", message);
  });

  activeRoom.onMessage("switch_map", async ({ map }: { map: string }) => {
    await connectInternal(map);
  });

  activeRoom.onMessage("player_attack", (message: { playerId: string; dir: Direction }) => {
    emit("playerAttack", message);
  });
}

export const connectToServer = async () => roomReady;

export const waitForRoom = () => roomReady;

export const getRoom = () => room;

export const getSessionId = () => sessionId;

export const sendMovement = (intent: { x: number; y: number }) => {
  room?.send("move", intent);
};

export const sendAttack = () => {
  room?.send("attack", {});
};

export const sendChat = (text: string) => {
  room?.send("chat", { text });
};

export const requestJoinMap = (map: string) => {
  room?.send("join", { map });
};

export const requestPickup = (dropId: string) => {
  room?.send("pickup", { dropId });
};

export const requestEquip = (itemId: string) => {
  room?.send("equip", { itemId });
};

export const requestUnequip = () => {
  room?.send("unequip", {});
};
