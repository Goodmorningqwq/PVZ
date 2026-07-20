import { RoomState } from './types.js';
import {
  advancePlantMatterPickups,
  advancePlants,
  advanceProjectiles,
  advanceSunPickups,
  advanceWaveState,
  advanceZombiesNormally,
  broadcastState,
  checkLawnBreach,
  collectPlantMatterPickup,
  collectSunPickup,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
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
  forceGameOver,
  initializePlayerSun,
  placePlant,
  setPlantMatter,
  setPlayerSun,
  spawnZombieInLane,
  useMatterOnPlant,
};

function runOnePlayerGameTick(room: RoomState) {
  room.tick += 1;
  advanceWaveState(room);
  advancePlants(room);
  advanceSunPickups(room);
  advancePlantMatterPickups(room);
  advanceProjectiles(room);
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
