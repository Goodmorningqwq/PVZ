import { Server as SocketIOServer } from 'socket.io';
import { broadcastState } from '../game/defaultGameEngine.js';
import { getRoom } from '../room/roomStore.js';

export type RoomEvents = {
  emitRoomJoined: (roomId: string, playerId: string) => void;
  emitState: (roomId: string) => void;
  maybeEmitGameOver: (roomId: string) => void;
  clearGameOverAnnouncement: (roomId: string) => void;
};

export function createRoomEvents(io: SocketIOServer): RoomEvents {
  const announcedGameOverRooms = new Set<string>();

  function emitRoomJoined(roomId: string, playerId: string) {
    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    const player = room.players.find((entry) => entry.playerId === playerId);
    if (!player) {
      return;
    }

    const opponentId = room.players.find((entry) => entry.playerId !== playerId)?.playerId || '';
    io.to(player.socketId).emit('room_joined', {
      roomId: room.roomId,
      playerId,
      opponentId,
    });
  }

  function emitState(roomId: string) {
    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    io.to(roomId).emit('state_update', broadcastState(room));
  }

  function maybeEmitGameOver(roomId: string) {
    const room = getRoom(roomId);
    if (!room || !room.gameOver || !room.result || announcedGameOverRooms.has(roomId)) {
      return;
    }

    // Co-op game: there's no per-player "winner" (see NETWORKING_CONTRACT_REVISED.md
    // and PROJECT_COMPLETE_GUIDE.md — both players win or lose together against the
    // zombies). The frontend's onGameOver handler (App.tsx) reads `payload.result`
    // as 'win' | 'lose'; a previous version of this function sent `winnerId`
    // instead, which meant `payload.result` was always undefined and every match
    // — win or lose — rendered as "The Lawn Was Overrun" on both players' screens.
    announcedGameOverRooms.add(roomId);
    io.to(roomId).emit('game_over', {
      result: room.result,
      reason: room.result === 'win' ? 'all_waves_cleared' : 'lawn_breached',
    });
  }

  function clearGameOverAnnouncement(roomId: string) {
    announcedGameOverRooms.delete(roomId);
  }

  return { emitRoomJoined, emitState, maybeEmitGameOver, clearGameOverAnnouncement };
}
