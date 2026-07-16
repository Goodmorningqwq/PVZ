import { Server as SocketIOServer, Socket } from 'socket.io';
import * as twoPlayerGameEngine from '../game/twoPlayerGameEngine.js';
import * as onePlayerGameEngine from '../game/onePlayerGameEngine.js';
import * as demoGameEngine from '../game/demoGameEngine.js';
import { getOrCreateRoom, getRoom, getSocketRoomId, hasTwoPlayers, removePlayerFromRooms, setSocketRoomId } from '../room/roomStore.js';
import { PlantType } from '../game/types.js';
import { isValidPlantType } from '../game/plants/plantBehaviors.js';
import { RoomEvents } from '../services/roomEvents.js';
import { log } from '../utils/logger.js';

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

      twoPlayerGameEngine.initializePlayerSun(room, playerId);

      if (hasTwoPlayers(roomId)) {
        roomEvents.emitRoomJoined(roomId, room.players[0].playerId);
        roomEvents.emitRoomJoined(roomId, room.players[1].playerId);
        roomEvents.emitState(roomId);
      }

      log('INFO', `Player joined room ${roomId}: ${playerId}`);
    });

    socket.on('join_one_player_room', (data: { playerId?: string }) => {
      const playerId = sanitizeId(data?.playerId);
      if (!playerId) {
        return;
      }

      const roomId = `oneplayer-${socket.id}`;
      const room = getOrCreateRoom(roomId, 'onePlayer');
      setSocketRoomId(socket.id, roomId);
      socket.join(roomId);

      const existingPlayer = room.players.find((player) => player.playerId === playerId);
      if (!existingPlayer) {
        room.players.push({ playerId, socketId: socket.id });
      } else {
        existingPlayer.socketId = socket.id;
      }

      onePlayerGameEngine.initializePlayerSun(room, playerId);
      roomEvents.emitRoomJoined(roomId, playerId);
      roomEvents.emitState(roomId);

      log('INFO', `Player joined one-player room ${roomId}: ${playerId}`);
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
      const plantType: PlantType | null = isValidPlantType(data?.plant) ? data.plant : null;
      const slotIndex = Number(data?.slotIndex);

      const room = getRoom(roomId);
      if (!room || room.gameOver || !plantType || !Number.isInteger(slotIndex)) {
        return;
      }

      let result: { success: boolean; message?: string };
      if (room.mode === 'demo') {
        result = demoGameEngine.placePlant(room, playerId, plantType, slotIndex);
      } else if (room.mode === 'onePlayer') {
        result = onePlayerGameEngine.placePlant(room, playerId, plantType, slotIndex);
      } else {
        result = twoPlayerGameEngine.placePlant(room, playerId, plantType, slotIndex);
      }
      if (!result.success) {
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Plant placed in room ${roomId}: ${playerId} placed ${plantType} in slot ${slotIndex}`);
    });

    // Fired by the frontend on both hover (desktop, continuous while the
    // cursor rests over a sun) and tap/click (touch devices, single-shot) —
    // the server doesn't distinguish between the two, it just validates the
    // sun still exists and (if coordinates are provided) that the requester
    // is actually in range, then credits both purses per the shared-economy
    // design (see collectSunPickup in defaultGameEngine.ts).
    socket.on('collect_sun', (data: { roomId?: string; playerId?: string; sunId?: string; x?: number; y?: number }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const sunId = sanitizeId(data?.sunId);
      const x = Number(data?.x);
      const y = Number(data?.y);

      const room = getRoom(roomId);
      if (!room || room.gameOver || !sunId) {
        return;
      }

      let result: { success: boolean; message?: string };
      if (room.mode === 'demo') {
        result = demoGameEngine.collectSunPickup(room, playerId, sunId, x, y);
      } else if (room.mode === 'onePlayer') {
        result = onePlayerGameEngine.collectSunPickup(room, playerId, sunId, x, y);
      } else {
        result = twoPlayerGameEngine.collectSunPickup(room, playerId, sunId, x, y);
      }
      if (!result.success) {
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Sun collected in room ${roomId}: ${playerId} collected ${sunId}`);
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
