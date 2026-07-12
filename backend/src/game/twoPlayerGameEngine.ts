import { RoomState } from './types';
import {
  advanceCombat,
  advanceEconomy,
  advanceProjectiles,
  advanceWaveState,
  advanceZombiesNormally,
  broadcastState,
  checkLawnBreach,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  setPlayerSun,
  spawnZombieInLane,
} from './defaultGameEngine';

export {
  broadcastState,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  setPlayerSun,
  spawnZombieInLane,
};

function runTwoPlayerGameTick(room: RoomState) {
  room.tick += 1;
  advanceWaveState(room);
  advanceEconomy(room);
  advanceCombat(room);
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
