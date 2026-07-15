import { PLANT_DEFS } from './config/gameConfig.js';
import PROJECTILE_DEFS from './config/projectileDefs.json' with { type: 'json' };

export type PlantType = keyof typeof PLANT_DEFS;
export type SlotProjectileType = keyof typeof PROJECTILE_DEFS;
export type WaveStatus = 'pending' | 'spawning' | 'break' | 'complete';
export type RoomMode = 'twoPlayer' | 'onePlayer' | 'demo';

export type PlayerState = {
  playerId: string;
  socketId: string;
};

export type SlotPlant = {
  type: PlantType;
  hp: number;
  ownerId: string;
  cooldown: number;
  sunTimer: number;
};

export type SlotProjectileState = {
  id: string;
  laneIndex: number;
  x: number;
  y: number;
  damage: number;
  speed: number;
  projectileType: SlotProjectileType;
  ownerId: string;
};

export type SlotState = {
  index: number;
  laneIndex: number;
  x: number;
  y: number;
  plant: SlotPlant | null;
};

export type ZombieState = {
  id: string;
  laneIndex: number;
  x: number;
  y: number;
  hp: number;
  chompCooldown: number;
};

export type SunPickupState = {
  id: string;
  laneIndex: number;
  x: number;
  y: number;
  amount: number;
  ticksRemaining: number;
};

export type RoomState = {
  roomId: string;
  mode: RoomMode;
  players: PlayerState[];
  slots: SlotState[];
  zombies: ZombieState[];
  projectiles: SlotProjectileState[];
  sunPickups: SunPickupState[];
  sun: Record<string, number>;
  tick: number;
  gameOver: boolean;
  result?: 'win' | 'lose';
  waveIndex: number;
  waveStatus: WaveStatus;
  waveTimer: number;
  zombiesSpawnedInWave: number;
};
