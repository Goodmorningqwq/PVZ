import { ZOMBIE_CHOMP_DAMAGE, ZOMBIE_CHOMP_INTERVAL_TICKS, ZOMBIE_DEFS } from '../config/gameConfig.js';
import { RoomState, SlotState, ZombieState, ZombieType } from '../types.js';

// Mirrors VALID_PLANTS / isValidPlantType in plantBehaviors.ts: the single
// source of truth for "what zombie types exist", derived from ZOMBIE_DEFS so
// adding a def is the only step. adminCli.ts previously hand-rolled its own
// `value in ZOMBIE_DEFS` check because this didn't exist.
export const VALID_ZOMBIES: ZombieType[] = Object.keys(ZOMBIE_DEFS) as ZombieType[];

export function isValidZombieType(value: unknown): value is ZombieType {
  return typeof value === 'string' && (VALID_ZOMBIES as string[]).includes(value);
}

export function advanceZombieEating(_room: RoomState, zombie: ZombieState, blockingSlot: SlotState) {
  zombie.chompCooldown -= 1;
  if (zombie.chompCooldown <= 0 && blockingSlot.plant) {
    blockingSlot.plant.hp -= ZOMBIE_CHOMP_DAMAGE;
    zombie.chompCooldown = ZOMBIE_CHOMP_INTERVAL_TICKS;
    if (blockingSlot.plant.hp <= 0) {
      blockingSlot.plant = null;
    }
  }
}

export const ZOMBIE_BEHAVIORS: Record<ZombieType, (room: RoomState, zombie: ZombieState, blockingSlot: SlotState) => void> = {
  shambler: advanceZombieEating,
  runner: advanceZombieEating,
};
