import * as twoPlayerGameEngine from '../game/twoPlayerGameEngine.js';
import * as onePlayerGameEngine from '../game/onePlayerGameEngine.js';
import * as demoGameEngine from '../game/demoGameEngine.js';
import { getRooms } from '../room/roomStore.js';
import { RoomEvents } from './roomEvents.js';

export function startGameLoop(tickRate: number, roomEvents: RoomEvents) {
  return setInterval(() => {
    for (const [roomId, room] of getRooms().entries()) {
      // Two-player rooms tick once a player has explicitly started the
      // match (see start_game in socketController.ts), and keep ticking
      // even if one player later disconnects — the match isn't paused by a
      // dropout, only by never having been started.
      const isReady = room.mode === 'twoPlayer'
        ? room.started
        : room.players.length >= 1;

      if (room.gameOver || !isReady) {
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
