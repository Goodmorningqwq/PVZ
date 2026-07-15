import { RoomState } from './types.js';
import {
  advanceCombat,
  advanceEconomy,
  advanceProjectiles,
  advanceSunPickups,
  advanceWaveState,
  advanceZombiesNormally,
  broadcastState,
  checkLawnBreach,
  collectSunPickup,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  setPlayerSun,
  spawnZombieInLane,
} from './defaultGameEngine.js';

export {
  broadcastState,
  collectSunPickup,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  setPlayerSun,
  spawnZombieInLane,
};

function runOnePlayerGameTick(room: RoomState) {
  room.tick += 1;
  advanceWaveState(room);
  advanceEconomy(room);
  advanceSunPickups(room);
  advanceCombat(room);
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
