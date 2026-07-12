import { Server as SocketIOServer, Socket } from 'socket.io';
import * as normalGameEngine from '../game/normalGameEngine';
import * as demoGameEngine from '../game/demoGameEngine';
import { getOrCreateRoom, getRoom, getSocketRoomId, hasTwoPlayers, removePlayerFromRooms, setSocketRoomId } from '../room/roomStore';
import { PlantType } from '../game/types';
import { RoomEvents } from '../services/roomEvents';
import { log } from '../utils/logger';

function sanitizeId(value: unknown): string {
  return String(value ?? '').trim();
}

export function registerSocketHandlers(io: SocketIOServer, roomEvents: RoomEvents) {
  io.on('connection', (socket: Socket) => {
    log('INFO', `Player connected: ${socket.id}`);

    socket.on('join_room', (data: { roomId?: string; playerId?: string }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);

      if (!roomId || !playerId) {
        return;
      }

      const room = getOrCreateRoom(roomId);
      setSocketRoomId(socket.id, roomId);
      socket.join(roomId);

      const existingPlayer = room.players.find((player) => player.playerId === playerId);
      if (!existingPlayer) {
        room.players.push({ playerId, socketId: socket.id });
      } else {
        existingPlayer.socketId = socket.id;
      }

      normalGameEngine.initializePlayerSun(room, playerId);

      if (hasTwoPlayers(roomId)) {
        roomEvents.emitRoomJoined(roomId, room.players[0].playerId);
        roomEvents.emitRoomJoined(roomId, room.players[1].playerId);
        roomEvents.emitState(roomId);
      }

      log('INFO', `Player joined room ${roomId}: ${playerId}`);
    });

    socket.on('join_demo_room', (data: { playerId?: string }) => {
      const playerId = sanitizeId(data?.playerId);
      if (!playerId) {
        return;
      }

      const roomId = `demo-${socket.id}`;
      const room = getOrCreateRoom(roomId, 'demo');
      setSocketRoomId(socket.id, roomId);
      socket.join(roomId);

      const existingPlayer = room.players.find((player) => player.playerId === playerId);
      if (!existingPlayer) {
        room.players.push({ playerId, socketId: socket.id });
      } else {
        existingPlayer.socketId = socket.id;
      }

      demoGameEngine.initializePlayerSun(room, playerId);
      roomEvents.emitRoomJoined(roomId, playerId);
      roomEvents.emitState(roomId);

      log('INFO', `Player joined demo room ${roomId}: ${playerId}`);
    });

    socket.on('place_plant', (data: { roomId?: string; playerId?: string; plant?: string; slotIndex?: number }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const plantType = data?.plant === 'peashooter' || data?.plant === 'sunflower' ? data.plant : null;
      const slotIndex = Number(data?.slotIndex);

      const room = getRoom(roomId);
      if (!room || room.gameOver || !plantType || !Number.isInteger(slotIndex)) {
        return;
      }

      const result = room.mode === 'demo'
        ? demoGameEngine.placePlant(room, playerId, plantType as PlantType, slotIndex)
        : normalGameEngine.placePlant(room, playerId, plantType as PlantType, slotIndex);
      if (!result.success) {
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Plant placed in room ${roomId}: ${playerId} placed ${plantType} in slot ${slotIndex}`);
    });

    socket.on('disconnect', () => {
      log('INFO', `Player disconnected: ${socket.id}`);

      const roomId = getSocketRoomId(socket.id);
      if (!roomId) {
        return;
      }

      const room = removePlayerFromRooms(socket.id);
      if (!room) {
        return;
      }

      if (room.players.length === 0) {
        roomEvents.clearGameOverAnnouncement(roomId);
      }
    });
  });
}
