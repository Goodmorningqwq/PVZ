import { v4 as uuidv4 } from 'uuid';
import { SLOT_COUNT, LANE_COUNT, PLANT_MATTER_OVERFLOW_GRACE_TICKS, TICK_RATE, getLaneY, getSlotX } from '../game/config/gameConfig.js';
import { ORCHESTRATION_STEPS_BY_DIFFICULTY } from '../game/config/orchestrationSteps.js';
import { RoomDifficulty, RoomMode, RoomState, SlotState } from '../game/types.js';

const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();

const ROOM_CAPACITY: Record<RoomMode, number> = {
  twoPlayer: 2,
  onePlayer: 1,
  demo: 1,
};

function buildSlots(): SlotState[] {
  const slots: SlotState[] = [];

  for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
    for (let col = 0; col < SLOT_COUNT; col += 1) {
      slots.push({
        index: laneIndex * SLOT_COUNT + col,
        laneIndex,
        x: getSlotX(col),
        y: getLaneY(laneIndex),
        plant: null,
      });
    }
  }

  return slots;
}

export function getOrCreateRoom(roomId: string, mode: RoomMode = 'twoPlayer', difficulty: RoomDifficulty = 'medium'): RoomState {
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom;
  }

  const firstStep = ORCHESTRATION_STEPS_BY_DIFFICULTY[difficulty][0];

  const createdRoom: RoomState = {
    roomId,
    mode,
    difficulty,
    players: [],
    originalPlayerIds: [],
    started: false,
    slots: buildSlots(),
    zombies: [],
    projectiles: [],
    birdProjectiles: [],
    slingshotCooldown: 0,
    sunPickups: [],
    plantMatterPickups: [],
    sun: {},
    plantUnlocks: {},
    plantMatter: 0,
    // Starts full: a fresh room is at 0 matter, nowhere near the cap.
    plantMatterOverflowGraceTicks: PLANT_MATTER_OVERFLOW_GRACE_TICKS,
    tick: 0,
    gameOver: false,
    orchestrationStepIndex: 0,
    // 'time' steps count down the full pause; 'event' steps start at 0 so the
    // first zombie spawns immediately (mirrors advanceToNextOrchestrationStep
    // in defaultGameEngine.ts).
    orchestrationStepTimer: firstStep.kind === 'time' ? firstStep.seconds * TICK_RATE : 0,
    orchestrationSpawnedInStep: 0,
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

export function getRoomCapacity(mode: RoomMode) {
  return ROOM_CAPACITY[mode];
}

// Once a room has admitted as many distinct player ids as its capacity, it's
// locked: those same ids may leave and rejoin, but no new id can take a seat
// — even one freed up by a disconnect.
export function canPlayerJoinRoom(room: RoomState, playerId: string) {
  return room.originalPlayerIds.includes(playerId) || room.originalPlayerIds.length < ROOM_CAPACITY[room.mode];
}

export function registerOriginalPlayer(room: RoomState, playerId: string) {
  if (!room.originalPlayerIds.includes(playerId)) {
    room.originalPlayerIds.push(playerId);
  }
}

export function createJoinPayload(room: RoomState, playerId: string) {
  const opponentId = room.players.find((player) => player.playerId !== playerId)?.playerId || '';
  return {
    roomId: room.roomId,
    playerId,
    opponentId,
  };
}
