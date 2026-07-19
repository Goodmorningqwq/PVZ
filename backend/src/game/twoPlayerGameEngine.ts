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
  setPlayerSun,
  spawnZombieInLane,
  useMatterOnPlant,
};

function runTwoPlayerGameTick(room: RoomState) {
  room.tick += 1;
  advanceWaveState(room);
  advancePlants(room);
  advanceSunPickups(room);
  advancePlantMatterPickups(room);
  advanceProjectiles(room);
  advanceZombiesNormally(room);
  checkLawnBreach(room);
}

export function advanceTwoPlayerRoom(room: RoomState) {
  if (room.gameOver || room.players.length < 2) {
    return;
  }

  runTwoPlayerGameTick(room);
}

export function advanceTwoPlayerRoomTicks(room: RoomState, ticks: number) {
  const totalTicks = Math.max(0, Math.floor(ticks));
  for (let index = 0; index < totalTicks; index += 1) {
    if (room.gameOver || room.players.length < 2) {
      return;
    }

    runTwoPlayerGameTick(room);
  }
}
