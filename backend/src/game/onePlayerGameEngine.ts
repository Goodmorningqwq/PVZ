import { RoomState } from './types.js';
import {
  advanceBirdProjectiles,
  advanceOrchestration,
  advancePlantMatterPickups,
  advancePlants,
  advanceProjectiles,
  advanceSlingshotCooldown,
  advanceSunPickups,
  advanceZombiesNormally,
  broadcastState,
  checkLawnBreach,
  collectPlantMatterPickup,
  collectSunPickup,
  endGame,
  fireSlingshot,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  removePlant,
  setPlantMatter,
  setPlayerSun,
  spawnZombieInLane,
  useMatterOnPlant,
} from './defaultGameEngine.js';

export {
  broadcastState,
  collectPlantMatterPickup,
  collectSunPickup,
  endGame,
  fireSlingshot,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  removePlant,
  setPlantMatter,
  setPlayerSun,
  spawnZombieInLane,
  useMatterOnPlant,
};

function runOnePlayerGameTick(room: RoomState) {
  room.tick += 1;
  advanceOrchestration(room);
  advancePlants(room);
  advanceSunPickups(room);
  advancePlantMatterPickups(room);
  advanceProjectiles(room);
  advanceSlingshotCooldown(room);
  advanceBirdProjectiles(room);
  advanceZombiesNormally(room);
  checkLawnBreach(room);
}

export function advanceOnePlayerRoom(room: RoomState) {
  if (room.gameOver || room.players.length < 1) {
    return;
  }

  runOnePlayerGameTick(room);
}

export function advanceOnePlayerRoomTicks(room: RoomState, ticks: number) {
  const totalTicks = Math.max(0, Math.floor(ticks));
  for (let index = 0; index < totalTicks; index += 1) {
    if (room.gameOver || room.players.length < 1) {
      return;
    }

    runOnePlayerGameTick(room);
  }
}
