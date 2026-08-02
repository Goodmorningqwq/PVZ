import { v4 as uuidv4 } from 'uuid';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  LAWN_BREACH_X,
  PLANT_DEFS,
  PLANT_MATTER_BUFF_COST_MULTIPLIER,
  PLANT_MATTER_BUFF_DURATION_TICKS,
  PLANT_MATTER_DROP_MAX,
  PLANT_MATTER_DROP_MIN,
  PLANT_MATTER_PICKUP_LIFETIME_TICKS,
  PLANT_MATTER_PICKUP_RADIUS,
  PLANT_MATTER_REPAIR_COST,
  PLANT_REMOVAL_REFUND_FRACTION,
  STARTING_SUN,
  SUN_PICKUP_RADIUS,
  TICK_RATE,
  ZOMBIE_DEFS,
  ZOMBIE_RADIUS,
  ZOMBIE_SPAWN_X,
  LANE_COUNT,
} from './config/gameConfig.js';
import { ORCHESTRATION_STEPS_BY_DIFFICULTY, OrchestrationStep } from './config/orchestrationSteps.js';
import PROJECTILE_DEFS from './config/projectileDefs.json' with { type: 'json' };
import {
  SLINGSHOT_COOLDOWN_TICKS,
  SLINGSHOT_MAX_PULL,
  SLINGSHOT_MIN_PULL_X,
  SLINGSHOT_RANGE_MULTIPLIER,
  SLINGSHOT_X,
  SLINGSHOT_Y,
  SLINGSHOT_BASE_FLIGHT_TICKS,
  SLINGSHOT_FLIGHT_TICKS_PER_100PX,
  SLINGSHOT_ZMAX_BASE,
  SLINGSHOT_ZMAX_PER_100PX,
  SLINGSHOT_DAMAGE,
  SLINGSHOT_SPLASH_RADIUS,
} from './config/slingshotConfig.js';
import { RoomState, SlotState, SlotProjectileState, BirdProjectileState, PlantType, WaveStatus, ZombieState, ZombieType } from './types.js';
import { PLANT_BEHAVIORS } from './plants/plantBehaviors.js';
import { ZOMBIE_BEHAVIORS } from './zombies/zombieBehaviors.js';

// Static per-plant info the shop UI needs (cost, display label) - computed
// once from PLANT_DEFS (the single source of truth for plant balance/rules)
// rather than duplicated as a hardcoded list on the frontend.
const PLANT_INFO = Object.fromEntries(
  Object.entries(PLANT_DEFS).map(([type, def]) => [type, { cost: def.cost, label: def.label }]),
);

export function roomLaneY(laneIndex: number): number {
  const laneMargin = 40;
  const laneSpacing = (400 - laneMargin * 2) / (LANE_COUNT - 1);
  return Math.round(laneMargin + laneSpacing * laneIndex);
}

export function initializePlayerSun(room: RoomState, playerId: string) {
  room.sun[playerId] = room.sun[playerId] ?? STARTING_SUN;
}

export function serializeSlots(room: RoomState) {
  return room.slots.map((slot) => ({
    index: slot.index,
    laneIndex: slot.laneIndex,
    x: slot.x,
    y: slot.y,
    plant: slot.plant
      ? {
          type: slot.plant.type,
          hp: slot.plant.hp,
          ownerId: slot.plant.ownerId,
          stamina: slot.plant.stamina,
          staminaMax: slot.plant.staminaMax,
          tired: slot.plant.stamina <= 0,
          buffed: slot.plant.buffTicksRemaining > 0,
        }
      : null,
  }));
}

export function broadcastState(room: RoomState) {
  return {
    tick: room.tick,
    slots: serializeSlots(room),
    projectiles: room.projectiles.map((projectile) => ({
      id: projectile.id,
      laneIndex: projectile.laneIndex,
      x: projectile.x,
      y: projectile.y,
      damage: projectile.damage,
      speed: projectile.speed,
      projectileType: projectile.projectileType,
      ownerId: projectile.ownerId,
    })),
    birdProjectiles: room.birdProjectiles.map((bird) => ({
      id: bird.id,
      x: bird.x,
      y: bird.y,
      z: birdHeightAt(bird, room.tick),
      ownerId: bird.ownerId,
      damage: bird.damage,
    })),
    slingshotCooldown: room.slingshotCooldown,
    zombies: room.zombies.map((zombie) => ({
      id: zombie.id,
      type: zombie.type,
      laneIndex: zombie.laneIndex,
      x: zombie.x,
      y: zombie.y,
      hp: zombie.hp,
    })),
    sunPickups: room.sunPickups.map((pickup) => ({
      id: pickup.id,
      laneIndex: pickup.laneIndex,
      x: pickup.x,
      y: pickup.y,
      amount: pickup.amount,
    })),
    plantMatterPickups: room.plantMatterPickups.map((pickup) => ({
      id: pickup.id,
      laneIndex: pickup.laneIndex,
      x: pickup.x,
      y: pickup.y,
      amount: pickup.amount,
    })),
    sun: { ...room.sun },
    plantMatter: room.plantMatter,
    plantDefs: PLANT_INFO,
    ...computeWaveDisplay(room),
  };
}

// Pure display shim: derives the legacy wave/waveStatus/totalWaves shape the
// frontend HUD already parses from the new step-based orchestration state,
// so the wire contract doesn't change even though RoomState no longer stores
// wave fields directly.
function computeWaveDisplay(room: RoomState): { wave: number; waveStatus: WaveStatus; totalWaves: number } {
  const steps = ORCHESTRATION_STEPS_BY_DIFFICULTY[room.difficulty];
  const totalWaves = steps.filter((step) => step.kind === 'event').length;

  let eventOrdinal = 0;
  for (let index = 0; index <= room.orchestrationStepIndex && index < steps.length; index += 1) {
    if (steps[index].kind === 'event') {
      eventOrdinal += 1;
    }
  }

  let waveStatus: WaveStatus;
  if (room.orchestrationStepIndex >= steps.length) {
    waveStatus = 'complete';
  } else if (steps[room.orchestrationStepIndex].kind === 'event') {
    waveStatus = 'spawning';
  } else if (eventOrdinal === 0) {
    waveStatus = 'pending';
  } else {
    waveStatus = 'break';
  }

  return { wave: eventOrdinal, waveStatus, totalWaves };
}

export function endGame(room: RoomState, result: 'win' | 'lose') {
  if (room.gameOver) {
    return;
  }

  room.gameOver = true;
  room.result = result;
}

export function spawnZombieInLane(room: RoomState, laneIndex: number, type: ZombieType) {
  const normalizedLaneIndex = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(laneIndex)));

  room.zombies.push({
    id: `z-${uuidv4()}`,
    type,
    laneIndex: normalizedLaneIndex,
    x: ZOMBIE_SPAWN_X,
    y: roomLaneY(normalizedLaneIndex),
    hp: ZOMBIE_DEFS[type].hp,
    chompCooldown: 0,
  });
}

export function spawnZombie(room: RoomState, type: ZombieType) {
  const laneIndex = Math.floor(Math.random() * LANE_COUNT);
  spawnZombieInLane(room, laneIndex, type);
}

export function stepDurationTicks(step: OrchestrationStep): number {
  return step.seconds * TICK_RATE;
}

// Walks the room's difficulty-selected step list sequentially: 'time' steps
// just pause, 'event' steps spawn their zombie list spread evenly across
// the step's duration. Replaces the old WAVES + advanceWaveState state
// machine — unlike that machine, this is purely time-driven (an 'event'
// step doesn't wait for the board to clear before the following 'time' step
// starts counting down). Only reaching the end of the list still gates the
// win on the board being clear.
export function advanceOrchestration(room: RoomState) {
  if (room.gameOver) {
    return;
  }

  const steps = ORCHESTRATION_STEPS_BY_DIFFICULTY[room.difficulty];

  if (room.orchestrationStepIndex >= steps.length) {
    if (room.zombies.length === 0) {
      endGame(room, 'win');
    }
    return;
  }

  const step = steps[room.orchestrationStepIndex];

  if (step.kind === 'time') {
    room.orchestrationStepTimer -= 1;
    if (room.orchestrationStepTimer <= 0) {
      advanceToNextOrchestrationStep(room);
    }
    return;
  }

  const sequence: ZombieType[] = step.zombies.flatMap((entry) => Array(entry.count).fill(entry.type));

  if (room.orchestrationSpawnedInStep < sequence.length) {
    if (room.orchestrationStepTimer <= 0) {
      spawnZombie(room, sequence[room.orchestrationSpawnedInStep]);
      room.orchestrationSpawnedInStep += 1;
      const remaining = sequence.length - room.orchestrationSpawnedInStep;
      room.orchestrationStepTimer = remaining > 0
        ? Math.max(1, Math.round(stepDurationTicks(step) / sequence.length))
        : 0;
    } else {
      room.orchestrationStepTimer -= 1;
    }
    return;
  }

  if (room.orchestrationStepTimer > 0) {
    room.orchestrationStepTimer -= 1;
    return;
  }

  advanceToNextOrchestrationStep(room);
}

function advanceToNextOrchestrationStep(room: RoomState) {
  room.orchestrationStepIndex += 1;
  room.orchestrationSpawnedInStep = 0;
  const nextStep = ORCHESTRATION_STEPS_BY_DIFFICULTY[room.difficulty][room.orchestrationStepIndex];
  // 'time' steps count down the full pause; 'event' steps start at 0 so the
  // first zombie spawns immediately rather than waiting a full step-duration.
  room.orchestrationStepTimer = nextStep && nextStep.kind === 'time' ? stepDurationTicks(nextStep) : 0;
}

export function advancePlants(room: RoomState) {
  for (const slot of room.slots) {
    if (!slot.plant) {
      continue;
    }

    // Buff decay is generic across all plant types (unlike stamina drain,
    // which is per-behavior since it's tied to each plant's specific action)
    // so it's handled once here rather than duplicated in every behavior.
    if (slot.plant.buffTicksRemaining > 0) {
      slot.plant.buffTicksRemaining -= 1;
    }

    const behavior = PLANT_BEHAVIORS[slot.plant.type];
    behavior?.(room, slot);
  }
}

export function advanceSunPickups(room: RoomState) {
  for (const pickup of room.sunPickups) {
    pickup.ticksRemaining -= 1;
  }

  room.sunPickups = room.sunPickups.filter((pickup) => pickup.ticksRemaining > 0);
}

export function advancePlantMatterPickups(room: RoomState) {
  for (const pickup of room.plantMatterPickups) {
    pickup.ticksRemaining -= 1;
  }

  room.plantMatterPickups = room.plantMatterPickups.filter((pickup) => pickup.ticksRemaining > 0);
}

// Called for both hover (continuous, while the cursor rests over a pickup)
// and tap/click (single-shot, for touch devices with no hover concept) —
// the frontend is responsible for choosing when to fire this; the server
// just validates the pickup still exists and is in range, and — per the
// shared-economy design — always credits both players' purses regardless of
// who collected it.
export function collectSunPickup(room: RoomState, playerId: string, sunId: string, playerX?: number, playerY?: number) {
  const pickupIndex = room.sunPickups.findIndex((pickup) => pickup.id === sunId);
  if (pickupIndex === -1) {
    return { success: false, message: 'Sun not found' };
  }

  const pickup = room.sunPickups[pickupIndex];

  if (Number.isFinite(playerX) && Number.isFinite(playerY)) {
    const dx = (playerX as number) - pickup.x;
    const dy = (playerY as number) - pickup.y;
    if (Math.sqrt(dx * dx + dy * dy) > SUN_PICKUP_RADIUS) {
      return { success: false, message: 'Out of range' };
    }
  }

  for (const player of room.players) {
    room.sun[player.playerId] = (room.sun[player.playerId] ?? 0) + pickup.amount;
  }

  room.sunPickups.splice(pickupIndex, 1);
  return { success: true };
}

// Mirrors collectSunPickup, but plant matter funds a single shared pool
// (room.plantMatter) rather than crediting per-player purses — both players
// draw from the same pot when repairing/buffing plants via useMatterOnPlant.
export function collectPlantMatterPickup(
  room: RoomState,
  playerId: string,
  matterId: string,
  playerX?: number,
  playerY?: number,
) {
  const pickupIndex = room.plantMatterPickups.findIndex((pickup) => pickup.id === matterId);
  if (pickupIndex === -1) {
    return { success: false, message: 'Plant matter not found' };
  }

  const pickup = room.plantMatterPickups[pickupIndex];

  if (Number.isFinite(playerX) && Number.isFinite(playerY)) {
    const dx = (playerX as number) - pickup.x;
    const dy = (playerY as number) - pickup.y;
    if (Math.sqrt(dx * dx + dy * dy) > PLANT_MATTER_PICKUP_RADIUS) {
      return { success: false, message: 'Out of range' };
    }
  }

  room.plantMatter += pickup.amount;
  room.plantMatterPickups.splice(pickupIndex, 1);
  return { success: true };
}

// Returns the fraction t in [0,1] along the segment (startX,startY)->(endX,endY)
// at which it first enters a circle of the given radius centered on
// (targetX,targetY), or null if the segment never enters that circle. This
// treats a tick's projectile movement as a swept line rather than a single
// point, so a fast projectile can't tunnel through a target it crossed over
// mid-tick.
function sweptCircleHitFraction(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  targetX: number,
  targetY: number,
  radius: number,
): number | null {
  const dx = endX - startX;
  const dy = endY - startY;
  const fx = startX - targetX;
  const fy = startY - targetY;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  // Already overlapping at the start of this tick's movement - that's the
  // earliest possible collision, regardless of where the segment ends up.
  if (c <= 0) {
    return 0;
  }

  if (a === 0) {
    return null;
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);

  if (t1 >= 0 && t1 <= 1) {
    return t1;
  }

  return null;
}

export function advanceProjectiles(room: RoomState) {
  const nextProjectiles: SlotProjectileState[] = [];

  for (const projectile of room.projectiles) {
    const projectileDef = PROJECTILE_DEFS[projectile.projectileType];
    if (!projectileDef) {
      continue;
    }

    projectile.damage = projectileDef.damage;
    projectile.speed = projectileDef.speed;

    const startX = projectile.x;
    const startY = projectile.y;
    const endX = startX + projectileDef.speed;
    const endY = startY;

    let hitZombie: ZombieState | null = null;
    let hitFraction = Infinity;

    for (const zombie of room.zombies) {
      if (zombie.laneIndex !== projectile.laneIndex) {
        continue;
      }

      const combinedRadius = projectileDef.radius + ZOMBIE_RADIUS;
      const fraction = sweptCircleHitFraction(startX, startY, endX, endY, zombie.x, zombie.y, combinedRadius);
      if (fraction === null) {
        continue;
      }

      if (fraction < hitFraction) {
        hitFraction = fraction;
        hitZombie = zombie;
      }
    }

    if (hitZombie) {
      // Stop the projectile at the collision point and consume it - it can't
      // pass through and hit anything else this tick.
      projectile.x = startX + hitFraction * (endX - startX);
      projectile.y = startY + hitFraction * (endY - startY);
      hitZombie.hp -= projectileDef.damage;

      // 100% drop chance on kill (not on breach — a breaching zombie ends
      // the game immediately, so there's nothing to collect anyway). Amount
      // is randomized per kill within the configured range.
      if (hitZombie.hp <= 0) {
        const amount = Math.round(
          PLANT_MATTER_DROP_MIN + Math.random() * (PLANT_MATTER_DROP_MAX - PLANT_MATTER_DROP_MIN),
        );
        room.plantMatterPickups.push({
          id: `pm-${uuidv4()}`,
          laneIndex: hitZombie.laneIndex,
          x: hitZombie.x,
          y: hitZombie.y,
          amount,
          ticksRemaining: PLANT_MATTER_PICKUP_LIFETIME_TICKS,
        });
      }

      continue;
    }

    projectile.x = endX;
    projectile.y = endY;

    if (projectile.x <= BOARD_WIDTH) {
      nextProjectiles.push(projectile);
    }
  }

  room.projectiles = nextProjectiles;
  room.zombies = room.zombies.filter((zombie) => zombie.hp > 0);
}

// Fraction of the flight elapsed, clamped to [0,1]. durationTicks is always
// >= 1 (see fireSlingshot), so this can't divide by zero.
function birdFlightT(bird: BirdProjectileState, tick: number): number {
  return Math.min(1, Math.max(0, (tick - bird.startTick) / bird.durationTicks));
}

// Height above the ground plane: a fixed-endpoint parabola that's 0 at
// launch (t=0) and landing (t=1), peaking at zMax when t=0.5. Purely a
// rendering value (see broadcastState) - the x/y board-plane position is
// what's used for splash-damage resolution below, not this.
function birdHeightAt(bird: BirdProjectileState, tick: number): number {
  const t = birdFlightT(bird, tick);
  return 4 * bird.zMax * t * (1 - t);
}

// Drag-to-fire. dx/dy is the raw pull vector (pointer - anchor) in board
// units; the server redoes the same math the client used for its trajectory
// preview rather than trusting a client-supplied target, so a shot can't be
// aimed anywhere out of range.
//
// Only a leftward pull (away from the fork, which faces rightward into the
// board) arms a shot - mirroring that pull through the anchor is what
// guarantees the resulting launch vector always points into the board
// instead of off the back of the slingshot toward the edge of the screen.
export function fireSlingshot(room: RoomState, playerId: string, dx: number, dy: number) {
  if (room.slingshotCooldown > 0) {
    return { success: false, message: 'on_cooldown' };
  }

  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return { success: false, message: 'invalid_pull' };
  }

  const pullMagnitude = Math.sqrt(dx * dx + dy * dy);
  const clampScale = pullMagnitude > SLINGSHOT_MAX_PULL && pullMagnitude > 0 ? SLINGSHOT_MAX_PULL / pullMagnitude : 1;
  const pullX = dx * clampScale;
  const pullY = dy * clampScale;

  if (-pullX < SLINGSHOT_MIN_PULL_X) {
    return { success: false, message: 'pull_too_small' };
  }

  const rawTargetX = SLINGSHOT_X - pullX * SLINGSHOT_RANGE_MULTIPLIER;
  const rawTargetY = SLINGSHOT_Y - pullY * SLINGSHOT_RANGE_MULTIPLIER;
  const clampedTargetX = Math.max(0, Math.min(BOARD_WIDTH, rawTargetX));
  const clampedTargetY = Math.max(0, Math.min(BOARD_HEIGHT, rawTargetY));

  // Snap to the nearest slot center - this is the "which box it ends up
  // hitting" the aiming is meant to resolve to, and gives splash damage a
  // clean, board-aligned impact point.
  let targetSlot: SlotState | null = null;
  let nearestDistance = Infinity;
  for (const slot of room.slots) {
    const slotDx = slot.x - clampedTargetX;
    const slotDy = slot.y - clampedTargetY;
    const distance = slotDx * slotDx + slotDy * slotDy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      targetSlot = slot;
    }
  }

  if (!targetSlot) {
    return { success: false, message: 'invalid_slot' };
  }

  const travelDx = targetSlot.x - SLINGSHOT_X;
  const travelDy = targetSlot.y - SLINGSHOT_Y;
  const travelDistance = Math.sqrt(travelDx * travelDx + travelDy * travelDy);

  const durationTicks = Math.max(
    1,
    Math.round(SLINGSHOT_BASE_FLIGHT_TICKS + (travelDistance / 100) * SLINGSHOT_FLIGHT_TICKS_PER_100PX),
  );
  const zMax = SLINGSHOT_ZMAX_BASE + (travelDistance / 100) * SLINGSHOT_ZMAX_PER_100PX;

  room.birdProjectiles.push({
    id: `bird-${uuidv4()}`,
    ownerId: playerId,
    startX: SLINGSHOT_X,
    startY: SLINGSHOT_Y,
    targetX: targetSlot.x,
    targetY: targetSlot.y,
    startTick: room.tick,
    durationTicks,
    zMax,
    damage: SLINGSHOT_DAMAGE,
    splashRadius: SLINGSHOT_SPLASH_RADIUS,
    x: SLINGSHOT_X,
    y: SLINGSHOT_Y,
  });

  room.slingshotCooldown = SLINGSHOT_COOLDOWN_TICKS;

  return { success: true };
}

export function advanceSlingshotCooldown(room: RoomState) {
  if (room.slingshotCooldown > 0) {
    room.slingshotCooldown -= 1;
  }
}

export function advanceBirdProjectiles(room: RoomState) {
  const remaining: BirdProjectileState[] = [];

  for (const bird of room.birdProjectiles) {
    const t = birdFlightT(bird, room.tick);
    bird.x = bird.startX + (bird.targetX - bird.startX) * t;
    bird.y = bird.startY + (bird.targetY - bird.startY) * t;

    if (t < 1) {
      remaining.push(bird);
      continue;
    }

    // Landed - splash damage to every zombie within range of the impact
    // point, regardless of lane (this is an AOE lob, not a lane-locked shot
    // like the peashooter's pea, so it can hit zombies in adjacent rows too).
    for (const zombie of room.zombies) {
      const zombieDx = zombie.x - bird.targetX;
      const zombieDy = zombie.y - bird.targetY;
      if (Math.sqrt(zombieDx * zombieDx + zombieDy * zombieDy) > bird.splashRadius) {
        continue;
      }

      zombie.hp -= bird.damage;
      if (zombie.hp <= 0) {
        const amount = Math.round(
          PLANT_MATTER_DROP_MIN + Math.random() * (PLANT_MATTER_DROP_MAX - PLANT_MATTER_DROP_MIN),
        );
        room.plantMatterPickups.push({
          id: `pm-${uuidv4()}`,
          laneIndex: zombie.laneIndex,
          x: zombie.x,
          y: zombie.y,
          amount,
          ticksRemaining: PLANT_MATTER_PICKUP_LIFETIME_TICKS,
        });
      }
    }
  }

  room.birdProjectiles = remaining;
  room.zombies = room.zombies.filter((zombie) => zombie.hp > 0);
}

export function advanceZombiesNormally(room: RoomState) {
  for (const zombie of room.zombies) {
    const speed = ZOMBIE_DEFS[zombie.type].speed;
    const laneSlots = room.slots.filter((slot) => slot.laneIndex === zombie.laneIndex);
    const blockingSlot = laneSlots.find((slot) => slot.plant && Math.abs(slot.x - zombie.x) < speed);

    if (blockingSlot) {
      zombie.x = blockingSlot.x;
      ZOMBIE_BEHAVIORS[zombie.type]?.(room, zombie, blockingSlot);
      continue;
    }

    zombie.chompCooldown = 0;
    const nextX = zombie.x - speed;
    const passedSlot = laneSlots.find((slot) => slot.plant && slot.x <= zombie.x && slot.x > nextX);
    zombie.x = passedSlot ? passedSlot.x : nextX;
  }
}

export function checkLawnBreach(room: RoomState) {
  if (room.zombies.some((zombie) => zombie.x <= LAWN_BREACH_X)) {
    endGame(room, 'lose');
  }
}

export function placePlant(room: RoomState, playerId: string, plantType: PlantType, slotIndex: number) {
  const slot: SlotState | undefined = room.slots[slotIndex];
  if (!slot) {
    return { success: false, message: 'Invalid slot' };
  }

  if (slot.plant) {
    return { success: false, message: 'Slot occupied' };
  }

  const def = PLANT_DEFS[plantType];
  const currentSun = room.sun[playerId] ?? 0;

  if (currentSun < def.cost) {
    return { success: false, message: 'Not enough sun' };
  }

  room.sun[playerId] = currentSun - def.cost;
  slot.plant = {
    type: plantType,
    hp: def.hp,
    ownerId: playerId,
    cooldown: plantType === 'peashooter' ? PLANT_DEFS.peashooter.cooldownTicks : 0,
    sunTimer: plantType === 'sunflower' ? PLANT_DEFS.sunflower.intervalTicks : 0,
    state: 'idle',
    stamina: def.staminaMax,
    staminaMax: def.staminaMax,
    buffTicksRemaining: 0,
  };

  return { success: true };
}

// Shovel: remove the plant in a slot and refund part of its sun cost. Either
// player may remove any plant (placement rights are fully shared, so removal
// rights are too), but the refund goes to the plant's owner — see
// PLANT_REMOVAL_REFUND_FRACTION in gameConfig.ts for why.
//
// Unlike placePlant, this rejects with explicit reasons rather than failing
// silently: a shovel click that does nothing is exactly the kind of thing a
// player can't diagnose on their own (same reasoning as useMatterOnPlant).
export function removePlant(room: RoomState, playerId: string, slotIndex: number) {
  const slot: SlotState | undefined = room.slots[slotIndex];
  if (!slot) {
    return { success: false, message: 'invalid_slot' };
  }

  if (!slot.plant) {
    return { success: false, message: 'no_plant_in_slot' };
  }

  const removedPlant = slot.plant;
  const def = PLANT_DEFS[removedPlant.type];
  const refund = Math.floor(def.cost * PLANT_REMOVAL_REFUND_FRACTION);

  // Fall back to the remover if the owner has somehow left the room (their
  // purse is gone from room.sun on disconnect), so the refund is never just
  // dropped on the floor.
  const refundTarget = removedPlant.ownerId in room.sun ? removedPlant.ownerId : playerId;
  room.sun[refundTarget] = (room.sun[refundTarget] ?? 0) + refund;

  slot.plant = null;

  return { success: true, action: 'remove', refund, refundTarget, plantType: removedPlant.type };
}

// Drag-to-repair/buff: the client only tells us which slot was targeted, not
// which action to perform — that's decided server-side based on whether the
// plant is currently tired. Tired -> repair (stamina reset to max). Not
// tired -> buff (temporary rate boost), at double the repair cost. Both draw
// from the single shared room.plantMatter pool.
export function useMatterOnPlant(room: RoomState, playerId: string, slotIndex: number) {
  const slot: SlotState | undefined = room.slots[slotIndex];
  if (!slot || !slot.plant) {
    return { success: false, message: 'No plant in that slot' };
  }

  const isTired = slot.plant.stamina <= 0;
  const cost = isTired ? PLANT_MATTER_REPAIR_COST : PLANT_MATTER_REPAIR_COST * PLANT_MATTER_BUFF_COST_MULTIPLIER;

  if (room.plantMatter < cost) {
    return { success: false, message: 'insufficient_plant_matter' };
  }

  room.plantMatter -= cost;

  if (isTired) {
    slot.plant.stamina = slot.plant.staminaMax;
  } else {
    slot.plant.buffTicksRemaining = PLANT_MATTER_BUFF_DURATION_TICKS;
  }

  return { success: true, action: isTired ? 'repair' : 'buff' };
}

export function setPlayerSun(room: RoomState, playerId: string, amount: number) {
  room.sun[playerId] = Math.max(0, Math.floor(amount));
}

export function setPlantMatter(room: RoomState, amount: number) {
  room.plantMatter = Math.max(0, Math.floor(amount));
}

export function forceGameOver(room: RoomState, result: 'win' | 'lose') {
  endGame(room, result);
}
