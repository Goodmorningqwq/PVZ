import * as twoPlayerGameEngine from '../game/twoPlayerGameEngine';
import * as onePlayerGameEngine from '../game/onePlayerGameEngine';
import * as demoGameEngine from '../game/demoGameEngine';
import { getRooms } from '../room/roomStore';
import { RoomEvents } from './roomEvents';

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
