import { Server as SocketIOServer, Socket } from 'socket.io';
import * as twoPlayerGameEngine from '../game/twoPlayerGameEngine.js';
import * as onePlayerGameEngine from '../game/onePlayerGameEngine.js';
import * as demoGameEngine from '../game/demoGameEngine.js';
import {
  canPlayerJoinRoom,
  getOrCreateRoom,
  getRoom,
  getRoomCapacity,
  getSocketRoomId,
  hasTwoPlayers,
  registerOriginalPlayer,
  removePlayerFromRooms,
  setSocketRoomId,
} from '../room/roomStore.js';
import { PlantType, RoomDifficulty } from '../game/types.js';
import { isValidPlantType } from '../game/plants/plantBehaviors.js';
import { RoomEvents } from '../services/roomEvents.js';
import { log } from '../utils/logger.js';

function sanitizeId(value: unknown): string {
  return String(value ?? '').trim();
}

const VALID_DIFFICULTIES: RoomDifficulty[] = ['easy', 'medium', 'hard'];

function sanitizeDifficulty(value: unknown): RoomDifficulty {
  return VALID_DIFFICULTIES.includes(value as RoomDifficulty) ? (value as RoomDifficulty) : 'medium';
}

export function registerSocketHandlers(io: SocketIOServer, roomEvents: RoomEvents) {
  io.on('connection', (socket: Socket) => {
    log('INFO', `Player connected: ${socket.id}`);

    socket.on('join_room', (data: { roomId?: string; playerId?: string; difficulty?: string }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const difficulty = sanitizeDifficulty(data?.difficulty);

      if (!roomId || !playerId) {
        return;
      }

      const room = getOrCreateRoom(roomId, 'twoPlayer', difficulty);

      if (!canPlayerJoinRoom(room, playerId)) {
        roomEvents.emitActionRejected(socket.id, {
          action: 'join_room',
          reason: room.started ? 'game_in_progress' : 'room_full',
        });
        log('INFO', `Rejected join to full room ${roomId}: ${playerId}`);
        return;
      }

      registerOriginalPlayer(room, playerId);
      setSocketRoomId(socket.id, roomId);
      socket.join(roomId);

      const existingPlayer = room.players.find((player) => player.playerId === playerId);
      if (!existingPlayer) {
        room.players.push({ playerId, socketId: socket.id });
      } else {
        existingPlayer.socketId = socket.id;
      }

      twoPlayerGameEngine.initializePlayerSun(room, playerId);
      twoPlayerGameEngine.initializePlayerUnlocks(room, playerId);
      roomEvents.emitRoomPlayersUpdate(roomId);

      if (room.started) {
        // Reconnect to a match already underway — confirm just to this
        // socket, regardless of whether the other original player is
        // currently connected, so a solo reconnect isn't stuck waiting.
        roomEvents.emitRoomJoined(roomId, playerId);
        roomEvents.emitState(roomId);
      } else if (hasTwoPlayers(roomId)) {
        roomEvents.emitRoomJoined(roomId, room.players[0].playerId);
        roomEvents.emitRoomJoined(roomId, room.players[1].playerId);
        roomEvents.emitState(roomId);
      }

      log('INFO', `Player joined room ${roomId}: ${playerId}`);
    });

    // Either original player may kick off the match once the room is full —
    // there's no "host" concept, so this is deliberately not restricted to
    // whoever created the room.
    socket.on('start_game', (data: { roomId?: string; playerId?: string }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);

      const room = getRoom(roomId);
      if (!room || room.mode !== 'twoPlayer' || room.started) {
        return;
      }

      const isInRoom = room.players.some((player) => player.playerId === playerId);
      if (!isInRoom || room.players.length < getRoomCapacity(room.mode)) {
        return;
      }

      room.started = true;
      roomEvents.emitGameStarted(roomId);
      roomEvents.emitState(roomId);
      log('INFO', `Game started in room ${roomId} by ${playerId}`);
    });

    socket.on('join_one_player_room', (data: { playerId?: string; difficulty?: string }) => {
      const playerId = sanitizeId(data?.playerId);
      if (!playerId) {
        return;
      }

      const difficulty = sanitizeDifficulty(data?.difficulty);
      const roomId = `oneplayer-${socket.id}`;
      const room = getOrCreateRoom(roomId, 'onePlayer', difficulty);
      setSocketRoomId(socket.id, roomId);
      socket.join(roomId);

      const existingPlayer = room.players.find((player) => player.playerId === playerId);
      if (!existingPlayer) {
        room.players.push({ playerId, socketId: socket.id });
      } else {
        existingPlayer.socketId = socket.id;
      }

      onePlayerGameEngine.initializePlayerSun(room, playerId);
      onePlayerGameEngine.initializePlayerUnlocks(room, playerId);
      roomEvents.emitRoomJoined(roomId, playerId);
      roomEvents.emitState(roomId);

      log('INFO', `Player joined one-player room ${roomId}: ${playerId}`);
    });

    socket.on('join_demo_room', (data: { playerId?: string; difficulty?: string }) => {
      const playerId = sanitizeId(data?.playerId);
      if (!playerId) {
        return;
      }

      const difficulty = sanitizeDifficulty(data?.difficulty);
      const roomId = `demo-${socket.id}`;
      const room = getOrCreateRoom(roomId, 'demo', difficulty);
      setSocketRoomId(socket.id, roomId);
      socket.join(roomId);

      const existingPlayer = room.players.find((player) => player.playerId === playerId);
      if (!existingPlayer) {
        room.players.push({ playerId, socketId: socket.id });
      } else {
        existingPlayer.socketId = socket.id;
      }

      demoGameEngine.initializePlayerSun(room, playerId);
      demoGameEngine.initializePlayerUnlocks(room, playerId);
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
        // Placement used to fail silently, per the convention for actions
        // whose failure is self-evident — you can see the slot is occupied,
        // and you can see your own sun. "You haven't unlocked that" is not
        // self-evident, so this now reports back.
        roomEvents.emitActionRejected(socket.id, {
          action: 'place_plant',
          reason: result.message || 'rejected',
        });
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Plant placed in room ${roomId}: ${playerId} placed ${plantType} in slot ${slotIndex}`);
    });

    // Shovel. Either player may remove any plant — placement rights are fully
    // shared, so removal rights are too — but the sun refund goes to whoever
    // originally paid for the plant (see removePlant in defaultGameEngine.ts).
    // Rejections get an explicit action_rejected rather than the silent drop
    // used by place_plant: a shovel swing that quietly does nothing is not
    // something a player can diagnose.
    socket.on('remove_plant', (data: { roomId?: string; playerId?: string; slotIndex?: number }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const slotIndex = Number(data?.slotIndex);

      const room = getRoom(roomId);
      if (!room || room.gameOver || !Number.isInteger(slotIndex)) {
        return;
      }

      let result: { success: boolean; message?: string; refund?: number };
      if (room.mode === 'demo') {
        result = demoGameEngine.removePlant(room, playerId, slotIndex);
      } else if (room.mode === 'onePlayer') {
        result = onePlayerGameEngine.removePlant(room, playerId, slotIndex);
      } else {
        result = twoPlayerGameEngine.removePlant(room, playerId, slotIndex);
      }

      if (!result.success) {
        roomEvents.emitActionRejected(socket.id, {
          action: 'remove_plant',
          reason: result.message || 'rejected',
        });
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Plant removed in room ${roomId}: ${playerId} removed slot ${slotIndex} (refund ${result.refund})`);
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

    // Same hover/tap dual-path pattern as collect_sun, but for plant matter
    // dropped by killed zombies.
    socket.on('collect_plant_matter', (data: { roomId?: string; playerId?: string; matterId?: string; x?: number; y?: number }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const matterId = sanitizeId(data?.matterId);
      const x = Number(data?.x);
      const y = Number(data?.y);

      const room = getRoom(roomId);
      if (!room || room.gameOver || !matterId) {
        return;
      }

      let result: { success: boolean; message?: string };
      if (room.mode === 'demo') {
        result = demoGameEngine.collectPlantMatterPickup(room, playerId, matterId, x, y);
      } else if (room.mode === 'onePlayer') {
        result = onePlayerGameEngine.collectPlantMatterPickup(room, playerId, matterId, x, y);
      } else {
        result = twoPlayerGameEngine.collectPlantMatterPickup(room, playerId, matterId, x, y);
      }
      if (!result.success) {
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Plant matter collected in room ${roomId}: ${playerId} collected ${matterId}`);
    });

    // Fired when the player drags the repair handle onto a plant. The
    // client only names the target slot - repair vs. buff and the exact
    // cost are decided server-side in useMatterOnPlant based on whether
    // that plant is currently tired, so the client can't cheat either
    // branch. On insufficient plant matter (or any other rejection) the
    // requester gets an explicit action_rejected event instead of silence,
    // since "why didn't my drag do anything" is much less discoverable
    // than a rejected plant placement or missed sun.
    socket.on('use_plant_matter', (data: { roomId?: string; playerId?: string; slotIndex?: number }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const slotIndex = Number(data?.slotIndex);

      const room = getRoom(roomId);
      if (!room || room.gameOver || !Number.isInteger(slotIndex)) {
        return;
      }

      let result: { success: boolean; message?: string; action?: string };
      if (room.mode === 'demo') {
        result = demoGameEngine.useMatterOnPlant(room, playerId, slotIndex);
      } else if (room.mode === 'onePlayer') {
        result = onePlayerGameEngine.useMatterOnPlant(room, playerId, slotIndex);
      } else {
        result = twoPlayerGameEngine.useMatterOnPlant(room, playerId, slotIndex);
      }

      if (!result.success) {
        roomEvents.emitActionRejected(socket.id, {
          action: 'use_plant_matter',
          reason: result.message || 'rejected',
        });
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Plant matter used in room ${roomId}: ${playerId} ${result.action} slot ${slotIndex}`);
    });

    // Slingshot fire. dx/dy is the raw pull vector the client dragged (pointer
    // minus the slingshot anchor) - the server redoes the same clamp/mirror/
    // snap-to-slot math the client used for its live trajectory preview
    // (see fireSlingshot in defaultGameEngine.ts) rather than trusting a
    // client-supplied target, so an aim can't be spoofed out of range.
    // Rejected with an explicit action_rejected (cooldown / pull too small)
    // rather than silently, matching remove_plant/use_plant_matter.
    socket.on('fire_slingshot', (data: { roomId?: string; playerId?: string; dx?: number; dy?: number }) => {
      const roomId = sanitizeId(data?.roomId);
      const playerId = sanitizeId(data?.playerId);
      const dx = Number(data?.dx);
      const dy = Number(data?.dy);

      const room = getRoom(roomId);
      if (!room || room.gameOver) {
        return;
      }

      let result: { success: boolean; message?: string };
      if (room.mode === 'demo') {
        result = demoGameEngine.fireSlingshot(room, playerId, dx, dy);
      } else if (room.mode === 'onePlayer') {
        result = onePlayerGameEngine.fireSlingshot(room, playerId, dx, dy);
      } else {
        result = twoPlayerGameEngine.fireSlingshot(room, playerId, dx, dy);
      }

      if (!result.success) {
        roomEvents.emitActionRejected(socket.id, {
          action: 'fire_slingshot',
          reason: result.message || 'rejected',
        });
        return;
      }

      roomEvents.emitState(roomId);
      log('INFO', `Slingshot fired in room ${roomId}: ${playerId}`);
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
      } else {
        roomEvents.emitRoomPlayersUpdate(roomId);
      }
    });
  });
}
