import { RoomState } from './types';
import {
  broadcastState,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  runCommonRoomTick,
  setPlayerSun,
  spawnZombieInLane,
} from './commonGameEngine';

export {
  broadcastState,
  endGame,
  forceGameOver,
  initializePlayerSun,
  placePlant,
  setPlayerSun,
  spawnZombieInLane,
};

export function advanceNormalRoom(room: RoomState) {
  if (room.gameOver || room.players.length < 2) {
    return;
  }

  runCommonRoomTick(room);
}

export function advanceNormalRoomTicks(room: RoomState, ticks: number) {
  const totalTicks = Math.max(0, Math.floor(ticks));
  for (let index = 0; index < totalTicks; index += 1) {
    if (room.gameOver || room.players.length < 2) {
      return;
    }

    runCommonRoomTick(room);
  }
}
