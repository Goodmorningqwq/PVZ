import { v4 as uuidv4 } from 'uuid';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PLANT_DEFS,
  PLANT_MATTER_BUFF_RATE_MULTIPLIER,
  PEASHOOTER_STAMINA_DRAIN_PER_SHOT,
  SUNFLOWER_STAMINA_DRAIN_PER_PROC,
  SUN_PICKUP_LIFETIME_TICKS,
  SUN_PICKUP_OFFSET_X_JITTER,
  SUN_PICKUP_OFFSET_Y,
  SUN_PICKUP_RADIUS,
  TIRED_RATE_MULTIPLIER,
} from '../config/gameConfig.js';
import PROJECTILE_DEFS from '../config/projectileDefs.json' with { type: 'json' };
import { PlantType, RoomState, SlotProjectileType, SlotState } from '../types.js';

// Every plant type must have an entry here - this is the single source of
// truth for "what plant types exist" that everything else (advancePlants,
// socketController's validation, etc.) derives from.
export const VALID_PLANTS: PlantType[] = Object.keys(PLANT_DEFS) as PlantType[];

export function isValidPlantType(value: unknown): value is PlantType {
  return typeof value === 'string' && (VALID_PLANTS as string[]).includes(value);
}

export function advanceSunflower(room: RoomState, slot: SlotState) {
  if (!slot.plant) {
    return;
  }

  slot.plant.sunTimer -= 1;
  if (slot.plant.sunTimer > 0) {
    return;
  }

  const def = PLANT_DEFS.sunflower;
  // A sunflower proc no longer credits purses directly — it drops a
  // collectible sun on the board that either player collects by
  // hovering/tapping it. Income is only awarded on collection
  // (collectSunPickup in defaultGameEngine.ts); an uncollected sun just
  // despawns for nothing once advanceSunPickups() times it out.
  //
  // The landing spot is offset from the sunflower's own slot position (not
  // dead-center on it) so the sun reads as a separate floating collectible
  // instead of visually merging into the sunflower's art — clamped to stay
  // on the board (this is also the collection hit-test point, so it must
  // stay reachable).
  const jitterX = (Math.random() * 2 - 1) * SUN_PICKUP_OFFSET_X_JITTER;
  const landingX = Math.min(BOARD_WIDTH - SUN_PICKUP_RADIUS, Math.max(SUN_PICKUP_RADIUS, slot.x + jitterX));
  const landingY = Math.min(
    BOARD_HEIGHT - SUN_PICKUP_RADIUS,
    Math.max(SUN_PICKUP_RADIUS, slot.y + SUN_PICKUP_OFFSET_Y),
  );

  room.sunPickups.push({
    id: `sun-${uuidv4()}`,
    laneIndex: slot.laneIndex,
    x: landingX,
    y: landingY,
    amount: def.sunAmount,
    ticksRemaining: SUN_PICKUP_LIFETIME_TICKS,
  });

  // Draining stamina on the same proc that spawns the sun (rather than
  // continuously) keeps "how many procs until tired" a clean, predictable
  // number for balancing, per the config comments on
  // SUNFLOWER_STAMINA_DRAIN_PER_PROC. Floored at 0 - stamina never goes
  // negative, it just sits at 0 (tired) until repaired.
  slot.plant.stamina = Math.max(0, slot.plant.stamina - SUNFLOWER_STAMINA_DRAIN_PER_PROC);

  // Tired takes priority over buffed (see the buffTicksRemaining comment in
  // types.ts) - a plant that runs itself down mid-buff falls straight to the
  // slow tired rate. Buff shortens the interval (faster procs); tired
  // lengthens it (slower procs).
  const isTired = slot.plant.stamina <= 0;
  const isBuffed = !isTired && slot.plant.buffTicksRemaining > 0;
  const effectiveInterval = isTired
    ? def.intervalTicks * TIRED_RATE_MULTIPLIER
    : isBuffed
      ? Math.round(def.intervalTicks / PLANT_MATTER_BUFF_RATE_MULTIPLIER)
      : def.intervalTicks;

  slot.plant.sunTimer = effectiveInterval;
}

export function advancePeashooter(room: RoomState, slot: SlotState) {
  if (!slot.plant) {
    return;
  }

  const zombieAhead = room.zombies.some(
    (zombie) => zombie.laneIndex === slot.laneIndex && zombie.x > slot.x,
  );
  slot.plant.state = zombieAhead ? 'attack' : 'idle';

  if (slot.plant.state !== 'attack') {
    return;
  }

  slot.plant.cooldown -= 1;
  if (slot.plant.cooldown > 0) {
    return;
  }

  const projectileDef = PROJECTILE_DEFS.pea;

  room.projectiles.push({
    id: `p-${uuidv4()}`,
    laneIndex: slot.laneIndex,
    x: slot.x + 10,
    y: slot.y,
    damage: projectileDef.damage,
    speed: projectileDef.speed,
    projectileType: projectileDef.projectileType as SlotProjectileType,
    ownerId: slot.plant.ownerId,
  });

  slot.plant.stamina = Math.max(0, slot.plant.stamina - PEASHOOTER_STAMINA_DRAIN_PER_SHOT);

  const isTired = slot.plant.stamina <= 0;
  const isBuffed = !isTired && slot.plant.buffTicksRemaining > 0;
  const baseCooldown = PLANT_DEFS.peashooter.cooldownTicks;
  slot.plant.cooldown = isTired
    ? baseCooldown * TIRED_RATE_MULTIPLIER
    : isBuffed
      ? Math.round(baseCooldown / PLANT_MATTER_BUFF_RATE_MULTIPLIER)
      : baseCooldown;
}

// Wall-nut is a pure blocker - it has no per-tick behavior of its own. Zombies
// stopping at (and chomping down) any occupied slot is already handled
// generically in advanceZombiesNormally, keyed only on slot.plant being
// present, not on plant type - so a high-hp def with a no-op behavior is
// enough to make it work as a wall.
export function advanceWallnut(_room: RoomState, _slot: SlotState) {}

// Maps each plant type to the function that decides what it does on a given
// tick - adding a new plant means adding a def to PLANT_DEFS, a behavior
// function above, and an entry here, with no changes needed anywhere else.
export const PLANT_BEHAVIORS: Record<PlantType, (room: RoomState, slot: SlotState) => void> = {
  sunflower: advanceSunflower,
  peashooter: advancePeashooter,
  wallnut: advanceWallnut,
};
