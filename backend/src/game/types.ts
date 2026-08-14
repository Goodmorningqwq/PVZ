import { PLANT_DEFS, ZOMBIE_DEFS } from './config/gameConfig.js';
import PROJECTILE_DEFS from './config/projectileDefs.json' with { type: 'json' };

export type PlantType = keyof typeof PLANT_DEFS;
export type ZombieType = keyof typeof ZOMBIE_DEFS;
export type SlotProjectileType = keyof typeof PROJECTILE_DEFS;
// Display-only status for the broadcast wave HUD, derived from orchestration
// state in defaultGameEngine.ts (see computeWaveDisplay) — not stored on RoomState.
export type WaveStatus = 'pending' | 'spawning' | 'break' | 'complete';
export type RoomMode = 'twoPlayer' | 'onePlayer' | 'demo';
export type RoomDifficulty = 'easy' | 'medium' | 'hard';
export type PlantState = 'idle' | 'attack';

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
  state: PlantState;
  stamina: number;
  staminaMax: number;
  // Ticks left on an active "fed" buff (1.5x rate) from useMatterOnPlant.
  // Tired (stamina <= 0) always takes priority over an active buff — a
  // plant that runs itself down mid-buff goes straight to the slow tired
  // rate rather than keeping the fast buffed rate until repaired.
  buffTicksRemaining: number;
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

// The slingshot's bird: unlike SlotProjectileState (lane-locked, straight
// line), this flies a fixed-endpoint parabolic lob across arbitrary
// board-plane coordinates. x/y/z are derived each tick from start/target/
// startTick/durationTicks/zMax (see computeBirdPosition in
// defaultGameEngine.ts) and cached on the object purely so broadcastState has
// something to read without recomputing — startTick/durationTicks/zMax remain
// the source of truth.
export type BirdProjectileState = {
  id: string;
  ownerId: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTick: number;
  durationTicks: number;
  zMax: number;
  damage: number;
  splashRadius: number;
  x: number;
  y: number;
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
  type: ZombieType;
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

export type PlantMatterPickupState = {
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
  difficulty: RoomDifficulty;
  players: PlayerState[];
  // Player ids ever admitted into this room, capped at the mode's capacity
  // and never removed on disconnect — this is what "locks" the room once
  // full, so a departed original player can still rejoin but a third
  // distinct id cannot take the empty seat.
  originalPlayerIds: string[];
  // twoPlayer rooms wait for an explicit start_game once full, rather than
  // auto-starting — this flag flips once and never resets, so a mid-match
  // disconnect can't re-pause the room (see gameLoop.ts / twoPlayerGameEngine.ts).
  started: boolean;
  slots: SlotState[];
  zombies: ZombieState[];
  projectiles: SlotProjectileState[];
  birdProjectiles: BirdProjectileState[];
  // Ticks remaining before the slingshot can fire again. Shared across both
  // players (co-op, one physical fixture on the board), same as
  // plantMatter — not a per-player resource like sun.
  slingshotCooldown: number;
  sunPickups: SunPickupState[];
  plantMatterPickups: PlantMatterPickupState[];
  sun: Record<string, number>;
  // Shared, not per-player like `sun` — a single pool both players draw from
  // to repair/buff plants (see plantBehaviors.ts / useMatterOnPlant).
  plantMatter: number;
  // Grace remaining before the overflow debuff bites, in ticks. Drains only
  // while plantMatter is over PLANT_MATTER_SOFT_MAX and refills instantly the
  // moment it isn't, so spending back under the cap always clears the penalty
  // rather than starting another timer. At 0 (and still over) every plant
  // slows — see isPlantMatterOverflowing in gameConfig.ts.
  plantMatterOverflowGraceTicks: number;
  tick: number;
  gameOver: boolean;
  result?: 'win' | 'lose';
  orchestrationStepIndex: number;
  orchestrationStepTimer: number;
  orchestrationSpawnedInStep: number;
};
