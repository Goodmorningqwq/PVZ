import { PlantType, RoomState } from './types.js';
import {
  advancePlantMatterPickups,
  advancePlants,
  advanceProjectiles,
  advanceSunPickups,
  advanceWaveState,
  broadcastState,
  checkLawnBreach,
  collectPlantMatterPickup as collectPlantMatterPickupCommon,
  collectSunPickup as collectSunPickupCommon,
  endGame,
  forceGameOver,
  placePlant as placePlantCommon,
  spawnZombieInLane,
  useMatterOnPlant as useMatterOnPlantCommon,
} from './defaultGameEngine.js';

export { broadcastState, endGame, forceGameOver, spawnZombieInLane };

const DEMO_SUN = 999999;
const DEMO_PLANT_MATTER = 999999;

function runDemoRoomTick(room: RoomState) {
  room.tick += 1;
  advanceWaveState(room);
  advancePlants(room);
  advanceSunPickups(room);
  advancePlantMatterPickups(room);
  advanceProjectiles(room);
  // Zombies stand still in the demo room, so there is no zombie-movement step here.
  checkLawnBreach(room);
  // Demo mode never runs dry - always top off the shared plant matter pool
  // back to a large constant, mirroring the DEMO_SUN treatment of per-player
  // purses below.
  room.plantMatter = DEMO_PLANT_MATTER;
}

export function initializePlayerSun(room: RoomState, playerId: string) {
  room.sun[playerId] = DEMO_SUN;
}

export function setPlayerSun(room: RoomState, playerId: string, _amount: number) {
  room.sun[playerId] = DEMO_SUN;
}

export function setPlantMatter(room: RoomState, _amount: number) {
  room.plantMatter = DEMO_PLANT_MATTER;
}

export function placePlant(room: RoomState, playerId: string, plantType: PlantType, slotIndex: number) {
  const result = placePlantCommon(room, playerId, plantType, slotIndex);
  if (result.success) {
    room.sun[playerId] = DEMO_SUN;
  }
  return result;
}

export function collectSunPickup(room: RoomState, playerId: string, sunId: string, playerX?: number, playerY?: number) {
  const result = collectSunPickupCommon(room, playerId, sunId, playerX, playerY);
  if (result.success) {
    for (const player of room.players) {
      room.sun[player.playerId] = DEMO_SUN;
    }
  }
  return result;
}

export function collectPlantMatterPickup(
  room: RoomState,
  playerId: string,
  matterId: string,
  playerX?: number,
  playerY?: number,
) {
  const result = collectPlantMatterPickupCommon(room, playerId, matterId, playerX, playerY);
  if (result.success) {
    room.plantMatter = DEMO_PLANT_MATTER;
  }
  return result;
}

export function useMatterOnPlant(room: RoomState, playerId: string, slotIndex: number) {
  const result = useMatterOnPlantCommon(room, playerId, slotIndex);
  room.plantMatter = DEMO_PLANT_MATTER;
  return result;
}

export function advanceDemoRoom(room: RoomState) {
  if (room.gameOver || room.players.length < 1) {
    return;
  }

  runDemoRoomTick(room);
}

export function advanceDemoRoomTicks(room: RoomState, ticks: number) {
  const totalTicks = Math.max(0, Math.floor(ticks));
  for (let index = 0; index < totalTicks; index += 1) {
    if (room.gameOver || room.players.length < 1) {
      return;
    }

    runDemoRoomTick(room);
  }
}
