import { ZOMBIE_DEFS } from '../config/gameConfig.js';
import { RoomState, SlotState, ZombieState, ZombieType } from '../types.js';

// Mirrors VALID_PLANTS / isValidPlantType in plantBehaviors.ts: the single
// source of truth for "what zombie types exist", derived from ZOMBIE_DEFS so
// adding a def is the only step. adminCli.ts previously hand-rolled its own
// `value in ZOMBIE_DEFS` check because this didn't exist.
export const VALID_ZOMBIES: ZombieType[] = Object.keys(ZOMBIE_DEFS) as ZombieType[];

export function isValidZombieType(value: unknown): value is ZombieType {
  return typeof value === 'string' && (VALID_ZOMBIES as string[]).includes(value);
}

// Chomp damage and interval come from the zombie's own def rather than global
// constants, so a heavier type can hit harder and at a different rhythm.
export function advanceZombieEating(_room: RoomState, zombie: ZombieState, blockingSlot: SlotState) {
  const def = ZOMBIE_DEFS[zombie.type];

  zombie.chompCooldown -= 1;
  if (zombie.chompCooldown <= 0 && blockingSlot.plant) {
    blockingSlot.plant.hp -= def.chompDamage;
    zombie.chompCooldown = def.chompIntervalTicks;
    if (blockingSlot.plant.hp <= 0) {
      blockingSlot.plant = null;
    }
  }
}

// Record<ZombieType, ...> means a new entry in ZOMBIE_DEFS without a matching
// behavior here is a compile error, not a silently inert zombie.
export const ZOMBIE_BEHAVIORS: Record<ZombieType, (room: RoomState, zombie: ZombieState, blockingSlot: SlotState) => void> = {
  shambler: advanceZombieEating,
  runner: advanceZombieEating,
  // The brute has no special behavior of its own — it's a stat block, not a
  // new mechanic. Everything that makes it feel different (slow approach,
  // heavy chomp, huge HP pool) already comes from its def.
  brute: advanceZombieEating,
};
