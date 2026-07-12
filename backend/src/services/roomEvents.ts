import { Server as SocketIOServer } from 'socket.io';
import { broadcastState } from '../game/defaultGameEngine';
import { getRoom } from '../room/roomStore';

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

    const winnerId = room.result === 'win'
      ? room.players[0]?.playerId || 'unknown'
      : room.players[1]?.playerId || 'unknown';

    announcedGameOverRooms.add(roomId);
    io.to(roomId).emit('game_over', {
      winnerId,
      reason: room.result === 'win' ? 'all_waves_cleared' : 'lawn_breached',
    });
  }

  function clearGameOverAnnouncement(roomId: string) {
    announcedGameOverRooms.delete(roomId);
  }

  return { emitRoomJoined, emitState, maybeEmitGameOver, clearGameOverAnnouncement };
}
