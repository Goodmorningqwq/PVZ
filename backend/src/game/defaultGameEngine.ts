import { v4 as uuidv4 } from 'uuid';
import { BOARD_WIDTH, LAWN_BREACH_X, PLANT_DEFS, STARTING_SUN, WAVE_BREAK_TICKS, WAVES, ZOMBIE_CHOMP_DAMAGE, ZOMBIE_CHOMP_INTERVAL_TICKS, ZOMBIE_HP, ZOMBIE_RADIUS, ZOMBIE_SPEED, ZOMBIE_SPAWN_X, LANE_COUNT } from './config/gameConfig.js';
import PROJECTILE_DEFS from './config/projectileDefs.json' with { type: 'json' };
import { RoomState, SlotState, SlotProjectileState, SlotProjectileType, PlantType, ZombieState } from './types.js';

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
    zombies: room.zombies.map((zombie) => ({
      id: zombie.id,
      laneIndex: zombie.laneIndex,
      x: zombie.x,
      y: zombie.y,
      hp: zombie.hp,
    })),
    sun: { ...room.sun },
    wave: room.waveIndex + 1,
    waveStatus: room.waveStatus,
    totalWaves: WAVES.length,
  };
}

export function endGame(room: RoomState, result: 'win' | 'lose') {
  if (room.gameOver) {
    return;
  }

  room.gameOver = true;
  room.result = result;
}

export function spawnZombieInLane(room: RoomState, laneIndex: number) {
  const normalizedLaneIndex = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(laneIndex)));

  room.zombies.push({
    id: `z-${uuidv4()}`,
    laneIndex: normalizedLaneIndex,
    x: ZOMBIE_SPAWN_X,
    y: roomLaneY(normalizedLaneIndex),
    hp: ZOMBIE_HP,
    chompCooldown: 0,
  });
}

export function spawnZombie(room: RoomState) {
  const laneIndex = Math.floor(Math.random() * LANE_COUNT);
  spawnZombieInLane(room, laneIndex);
}

export function advanceWaveState(room: RoomState) {
  if (room.waveStatus === 'pending') {
    room.waveTimer -= 1;
    if (room.waveTimer <= 0) {
      room.waveIndex = 0;
      room.waveStatus = 'spawning';
      room.zombiesSpawnedInWave = 0;
      room.waveTimer = 0;
    }
    return;
  }

  if (room.waveStatus === 'spawning') {
    const wave = WAVES[room.waveIndex];

    if (room.zombiesSpawnedInWave < wave.count) {
      if (room.waveTimer <= 0) {
        spawnZombie(room);
        room.zombiesSpawnedInWave += 1;
        room.waveTimer = wave.spawnIntervalTicks;
      } else {
        room.waveTimer -= 1;
      }
      return;
    }

    if (room.zombies.length === 0) {
      if (room.waveIndex + 1 >= WAVES.length) {
        room.waveStatus = 'complete';
        endGame(room, 'win');
        return;
      }
      room.waveStatus = 'break';
      room.waveTimer = WAVE_BREAK_TICKS;
    }
    return;
  }

  if (room.waveStatus === 'break') {
    room.waveTimer -= 1;
    if (room.waveTimer <= 0) {
      room.waveIndex += 1;
      room.waveStatus = 'spawning';
      room.zombiesSpawnedInWave = 0;
      room.waveTimer = 0;
    }
  }
}

export function advanceEconomy(room: RoomState) {
  for (const slot of room.slots) {
    if (!slot.plant || slot.plant.type !== 'sunflower') {
      continue;
    }

    slot.plant.sunTimer -= 1;
    if (slot.plant.sunTimer <= 0) {
      const def = PLANT_DEFS.sunflower;
      for (const player of room.players) {
        room.sun[player.playerId] = (room.sun[player.playerId] ?? 0) + def.sunAmount;
      }
      slot.plant.sunTimer = def.intervalTicks;
    }
  }
}

export function advanceCombat(room: RoomState) {
  for (const slot of room.slots) {
    if (!slot.plant || slot.plant.type !== 'peashooter') {
      continue;
    }

    slot.plant.cooldown -= 1;
    if (slot.plant.cooldown > 0) {
      continue;
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
    slot.plant.cooldown = PLANT_DEFS.peashooter.cooldownTicks;
  }
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

export function advanceZombiesNormally(room: RoomState) {
  for (const zombie of room.zombies) {
    const laneSlots = room.slots.filter((slot) => slot.laneIndex === zombie.laneIndex);
    const blockingSlot = laneSlots.find((slot) => slot.plant && Math.abs(slot.x - zombie.x) < ZOMBIE_SPEED);

    if (blockingSlot) {
      zombie.x = blockingSlot.x;
      zombie.chompCooldown -= 1;
      if (zombie.chompCooldown <= 0 && blockingSlot.plant) {
        blockingSlot.plant.hp -= ZOMBIE_CHOMP_DAMAGE;
        zombie.chompCooldown = ZOMBIE_CHOMP_INTERVAL_TICKS;
        if (blockingSlot.plant.hp <= 0) {
          blockingSlot.plant = null;
        }
      }
      continue;
    }

    zombie.chompCooldown = 0;
    const nextX = zombie.x - ZOMBIE_SPEED;
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
  };

  return { success: true };
}

export function setPlayerSun(room: RoomState, playerId: string, amount: number) {
  room.sun[playerId] = Math.max(0, Math.floor(amount));
}

export function forceGameOver(room: RoomState, result: 'win' | 'lose') {
  endGame(room, result);
}
