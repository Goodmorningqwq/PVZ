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

function runTwoPlayerGameTick(room: RoomState) {
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

export function advanceTwoPlayerRoom(room: RoomState) {
  // Gated on the explicit started flag, not players (who's currently
  // connected) — a mid-match disconnect must not pause the tick.
  if (room.gameOver || !room.started) {
    return;
  }

  runTwoPlayerGameTick(room);
}

export function advanceTwoPlayerRoomTicks(room: RoomState, ticks: number) {
  const totalTicks = Math.max(0, Math.floor(ticks));
  for (let index = 0; index < totalTicks; index += 1) {
    if (room.gameOver || !room.started) {
      return;
    }

    runTwoPlayerGameTick(room);
  }
}
