import * as twoPlayerGameEngine from '../game/twoPlayerGameEngine.js';
import * as onePlayerGameEngine from '../game/onePlayerGameEngine.js';
import * as demoGameEngine from '../game/demoGameEngine.js';
import { getRooms } from '../room/roomStore.js';
import { RoomEvents } from './roomEvents.js';

export function startGameLoop(tickRate: number, roomEvents: RoomEvents) {
  return setInterval(() => {
    for (const [roomId, room] of getRooms().entries()) {
      const minPlayers = room.mode === 'twoPlayer' ? 2 : 1;
      if (room.gameOver || room.players.length < minPlayers) {
        continue;
      }

      if (room.mode === 'demo') {
        demoGameEngine.advanceDemoRoom(room);
      } else if (room.mode === 'onePlayer') {
        onePlayerGameEngine.advanceOnePlayerRoom(room);
      } else {
        twoPlayerGameEngine.advanceTwoPlayerRoom(room);
      }

      roomEvents.emitState(roomId);
      roomEvents.maybeEmitGameOver(roomId);
    }
  }, 1000 / tickRate);
}
