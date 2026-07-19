import { v4 as uuidv4 } from 'uuid';
import { PRE_GAME_DELAY_TICKS, SLOT_COUNT, SLOT_MARGIN, BOARD_HEIGHT, BOARD_WIDTH, LANE_COUNT, LANE_MARGIN } from '../game/config/gameConfig.js';
import { RoomMode, RoomState, SlotState } from '../game/types.js';

const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();

function getLaneY(laneIndex: number): number {
  const laneSpacing = (BOARD_HEIGHT - LANE_MARGIN * 2) / (LANE_COUNT - 1);
  return Math.round(LANE_MARGIN + laneSpacing * laneIndex);
}

function buildSlots(): SlotState[] {
  const slots: SlotState[] = [];
  const slotSpacing = (BOARD_WIDTH - SLOT_MARGIN * 2) / SLOT_COUNT;

  for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
    for (let col = 0; col < SLOT_COUNT; col += 1) {
      slots.push({
        index: laneIndex * SLOT_COUNT + col,
        laneIndex,
        x: Math.round(SLOT_MARGIN + slotSpacing * (col + 0.5)),
        y: getLaneY(laneIndex),
        plant: null,
      });
    }
  }

  return slots;
}

export function getOrCreateRoom(roomId: string, mode: RoomMode = 'twoPlayer'): RoomState {
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom;
  }

  const createdRoom: RoomState = {
    roomId,
    mode,
    players: [],
    slots: buildSlots(),
    zombies: [],
    projectiles: [],
    sunPickups: [],
    plantMatterPickups: [],
    sun: {},
    plantMatter: 0,
    tick: 0,
    gameOver: false,
    waveIndex: -1,
    waveStatus: 'pending',
    waveTimer: PRE_GAME_DELAY_TICKS,
    zombiesSpawnedInWave: 0,
  };

  rooms.set(roomId, createdRoom);
  return createdRoom;
}

export function getRoom(roomId: string) {
  return rooms.get(roomId);
}

export function getRoomCount() {
  return rooms.size;
}

export function deleteRoom(roomId: string) {
  rooms.delete(roomId);
}

export function getRooms() {
  return rooms;
}

export function getSocketRoomId(socketId: string) {
  return socketToRoom.get(socketId);
}

export function setSocketRoomId(socketId: string, roomId: string) {
  socketToRoom.set(socketId, roomId);
}

export function clearSocketRoomId(socketId: string) {
  socketToRoom.delete(socketId);
}

export function removePlayerFromRooms(socketId: string) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) {
    return null;
  }

  const room = rooms.get(roomId);
  if (!room) {
    socketToRoom.delete(socketId);
    return null;
  }

  room.players = room.players.filter((player) => player.socketId !== socketId);
  socketToRoom.delete(socketId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
  }

  return room;
}

export function addPlayer(roomId: string, playerId: string, socketId: string) {
  const room = getOrCreateRoom(roomId);
  const existingPlayer = room.players.find((player) => player.playerId === playerId);

  if (!existingPlayer) {
    room.players.push({ playerId, socketId });
    return room;
  }

  existingPlayer.socketId = socketId;
  return room;
}

export function hasTwoPlayers(roomId: string) {
  return (rooms.get(roomId)?.players.length ?? 0) === 2;
}

export function createJoinPayload(room: RoomState, playerId: string) {
  const opponentId = room.players.find((player) => player.playerId !== playerId)?.playerId || '';
  return {
    roomId: room.roomId,
    playerId,
    opponentId,
  };
}
