import { io } from 'socket.io-client';
import { BACKEND_URL } from './config';

let socket = null;
let latestState = {
  sun: {},
  slots: [],
  projectiles: [],
  zombies: [],
  tick: 0,
  wave: 0,
  waveStatus: 'pending',
  totalWaves: 0,
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
    slots: normalizeSlots(payload?.slots),
    projectiles: normalizeProjectiles(payload?.projectiles),
    zombies: normalizeEntities(payload?.zombies),
    tick: Number.isFinite(payload?.tick) ? payload.tick : 0,
    wave: Number.isFinite(payload?.wave) ? payload.wave : 0,
    waveStatus: typeof payload?.waveStatus === 'string' ? payload.waveStatus : 'pending',
    totalWaves: Number.isFinite(payload?.totalWaves) ? payload.totalWaves : 0,
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

function normalizeSlots(slots) {
  if (!Array.isArray(slots)) {
    return [];
  }

  return slots
    .map((slot) => {
      if (!slot || typeof slot !== 'object') {
        return null;
      }

      const plant = slot.plant && typeof slot.plant === 'object'
        ? {
            type: String(slot.plant.type ?? ''),
            hp: Number(slot.plant.hp),
            ownerId: String(slot.plant.ownerId ?? ''),
          }
        : null;

      return {
        index: Number(slot.index),
        x: Number(slot.x),
        y: Number(slot.y),
        plant,
      };
    })
    .filter((slot) => slot && Number.isInteger(slot.index) && Number.isFinite(slot.x) && Number.isFinite(slot.y));
}

function normalizeProjectiles(projectiles) {
  if (!Array.isArray(projectiles)) {
    return [];
  }

  return projectiles
    .map((projectile) => {
      if (!projectile || typeof projectile !== 'object') {
        return null;
      }

      return {
        ...projectile,
        id: String(projectile.id ?? ''),
        laneIndex: Number(projectile.laneIndex),
        x: Number(projectile.x),
        y: Number(projectile.y),
        damage: Number(projectile.damage),
        speed: Number(projectile.speed),
        projectileType: String(projectile.projectileType ?? ''),
        ownerId: String(projectile.ownerId ?? ''),
      };
    })
    .filter((projectile) =>
      projectile
      && projectile.id
      && Number.isInteger(projectile.laneIndex)
      && Number.isFinite(projectile.x)
      && Number.isFinite(projectile.y)
      && Number.isFinite(projectile.damage)
      && Number.isFinite(projectile.speed)
      && projectile.projectileType,
    );
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

export function connectDemo({ playerId }) {
  const activeSocket = createSocket();
  const normalizedPlayerId = toStringId(playerId);

  if (!normalizedPlayerId) {
    return activeSocket;
  }

  activeSocket.once('connect', () => {
    activeSocket.emit('join_demo_room', { playerId: normalizedPlayerId });
  });

  if (!activeSocket.connected) {
    activeSocket.connect();
    return activeSocket;
  }

  activeSocket.emit('join_demo_room', { playerId: normalizedPlayerId });
  return activeSocket;
}

export function emitPlacePlant({ roomId, playerId, plant, slotIndex }) {
  if (!socket) {
    return;
  }

  const normalizedRoomId = toStringId(roomId);
  const normalizedPlayerId = toStringId(playerId);
  const normalizedSlotIndex = toFiniteNumber(slotIndex);

  if (!normalizedRoomId || !normalizedPlayerId || normalizedSlotIndex === null || !plant) {
    return;
  }

  socket.emit('place_plant', {
    roomId: normalizedRoomId,
    playerId: normalizedPlayerId,
    plant,
    slotIndex: normalizedSlotIndex,
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