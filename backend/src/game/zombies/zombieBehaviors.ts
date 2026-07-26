import { ZOMBIE_CHOMP_DAMAGE, ZOMBIE_CHOMP_INTERVAL_TICKS } from '../config/gameConfig.js';
import { RoomState, SlotState, ZombieState, ZombieType } from '../types.js';

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
