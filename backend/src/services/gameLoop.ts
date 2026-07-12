import * as normalGameEngine from '../game/normalGameEngine';
import * as demoGameEngine from '../game/demoGameEngine';
import { getRooms } from '../room/roomStore';
import { RoomEvents } from './roomEvents';

export function startGameLoop(tickRate: number, roomEvents: RoomEvents) {
  return setInterval(() => {
    for (const [roomId, room] of getRooms().entries()) {
      const minPlayers = room.mode === 'demo' ? 1 : 2;
      if (room.gameOver || room.players.length < minPlayers) {
        continue;
      }

      if (room.mode === 'demo') {
        demoGameEngine.advanceDemoRoom(room);
      } else {
        normalGameEngine.advanceNormalRoom(room);
      }

      roomEvents.emitState(roomId);
      roomEvents.maybeEmitGameOver(roomId);
    }
  }, 1000 / tickRate);
}
