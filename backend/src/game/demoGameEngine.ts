import { PlantType, RoomState } from './types.js';
import {
  advanceCombat,
  advanceEconomy,
  advanceProjectiles,
  advanceSunPickups,
  advanceWaveState,
  broadcastState,
  checkLawnBreach,
  collectSunPickup as collectSunPickupCommon,
  endGame,
  forceGameOver,
  placePlant as placePlantCommon,
  spawnZombieInLane,
} from './defaultGameEngine.js';

export { broadcastState, endGame, forceGameOver, spawnZombieInLane };

const DEMO_SUN = 999999;

function runDemoRoomTick(room: RoomState) {
  room.tick += 1;
  advanceWaveState(room);
  advanceEconomy(room);
  advanceSunPickups(room);
  advanceCombat(room);
  advanceProjectiles(room);
  // Zombies stand still in the demo room, so there is no zombie-movement step here.
  checkLawnBreach(room);
}

export function initializePlayerSun(room: RoomState, playerId: string) {
  room.sun[playerId] = DEMO_SUN;
}

export function setPlayerSun(room: RoomState, playerId: string, _amount: number) {
  room.sun[playerId] = DEMO_SUN;
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
