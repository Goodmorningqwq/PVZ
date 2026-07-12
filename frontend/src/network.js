import { io } from 'socket.io-client';
import { BACKEND_URL } from './config';

let socket = null;
let latestState = {
  sun: {},
  towers: [],
  zombies: [],
  tick: 0,
};

const roomJoinedListeners = new Set();
const stateUpdateListeners = new Set();
const gameOverListeners = new Set();

function createSocket() {
  if (socket) {
    return socket;
  }

  socket = io(BACKEND_URL, {
    autoConnect: false,
    transports: ['websocket'],
  });

  socket.on('room_joined', (payload) => {
    roomJoinedListeners.forEach((listener) => listener(payload));
  });

  socket.on('state_update', (payload) => {
    latestState = normalizeState(payload);
    stateUpdateListeners.forEach((listener) => listener(latestState));
  });

  socket.on('game_over', (payload) => {
    gameOverListeners.forEach((listener) => listener(payload));
  });

  return socket;
}

function normalizeState(payload) {
  return {
    sun: normalizeSun(payload?.sun),
    towers: normalizeEntities(payload?.towers),
    zombies: normalizeEntities(payload?.zombies),
    tick: Number.isFinite(payload?.tick) ? payload.tick : 0,
  };
}

function normalizeEntities(entities) {
  if (!Array.isArray(entities)) {
    return [];
  }

  return entities
    .map((entity) => {
      if (!entity || typeof entity !== 'object') {
        return null;
      }

      return {
        ...entity,
        id: String(entity.id ?? ''),
        x: Number(entity.x),
        y: Number(entity.y),
      };
    })
    .filter((entity) => entity && entity.id && Number.isFinite(entity.x) && Number.isFinite(entity.y));
}

function normalizeSun(sun) {
  if (!sun || typeof sun !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(sun)
      .filter(([playerId]) => typeof playerId === 'string' && playerId.length > 0)
      .map(([playerId, value]) => [playerId, Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  );
}

function toStringId(value) {
  return String(value ?? '');
}

function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function connect({ roomId, playerId }) {
  const activeSocket = createSocket();
  const normalizedRoomId = toStringId(roomId);
  const normalizedPlayerId = toStringId(playerId);

  if (!normalizedRoomId || !normalizedPlayerId) {
    return activeSocket;
  }

  activeSocket.once('connect', () => {
    activeSocket.emit('join_room', {
      roomId: normalizedRoomId,
      playerId: normalizedPlayerId,
    });
  });

  if (!activeSocket.connected) {
    activeSocket.connect();
    return activeSocket;
  }

  activeSocket.emit('join_room', {
    roomId: normalizedRoomId,
    playerId: normalizedPlayerId,
  });
  return activeSocket;
}

export function emitPlacePlant({ roomId, playerId, x, y }) {
  if (!socket) {
    return;
  }

  const normalizedRoomId = toStringId(roomId);
  const normalizedPlayerId = toStringId(playerId);
  const normalizedX = toFiniteNumber(x);
  const normalizedY = toFiniteNumber(y);

  if (!normalizedRoomId || !normalizedPlayerId || normalizedX === null || normalizedY === null) {
    return;
  }

  socket.emit('place_plant', {
    roomId: normalizedRoomId,
    playerId: normalizedPlayerId,
    x: normalizedX,
    y: normalizedY,
  });
}

export function onRoomJoined(listener) {
  roomJoinedListeners.add(listener);
  return () => roomJoinedListeners.delete(listener);
}

export function onStateUpdate(listener) {
  stateUpdateListeners.add(listener);
  return () => stateUpdateListeners.delete(listener);
}

export function onGameOver(listener) {
  gameOverListeners.add(listener);
  return () => gameOverListeners.delete(listener);
}

export function getLatestState() {
  return latestState;
}

export function disconnect() {
  if (!socket) {
    return;
  }

  socket.disconnect();
}