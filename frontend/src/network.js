import { io } from 'socket.io-client';
import { BACKEND_URL } from './config';

let socket = null;
let latestState = {
  sun: {},
  plantMatter: 0,
  slots: [],
  projectiles: [],
  sunPickups: [],
  plantMatterPickups: [],
  zombies: [],
  plantDefs: {},
  tick: 0,
  wave: 0,
  waveStatus: 'pending',
  totalWaves: 0,
};

const roomJoinedListeners = new Set();
const stateUpdateListeners = new Set();
const gameOverListeners = new Set();
const actionRejectedListeners = new Set();

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

  socket.on('action_rejected', (payload) => {
    actionRejectedListeners.forEach((listener) => listener(payload));
  });

  return socket;
}

function normalizeState(payload) {
  return {
    sun: normalizeSun(payload?.sun),
    plantMatter: Number.isFinite(payload?.plantMatter) ? payload.plantMatter : 0,
    slots: normalizeSlots(payload?.slots),
    projectiles: normalizeProjectiles(payload?.projectiles),
    sunPickups: normalizeSunPickups(payload?.sunPickups),
    plantMatterPickups: normalizePlantMatterPickups(payload?.plantMatterPickups),
    zombies: normalizeEntities(payload?.zombies),
    plantDefs: normalizePlantDefs(payload?.plantDefs),
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
            stamina: Number.isFinite(slot.plant.stamina) ? slot.plant.stamina : 0,
            staminaMax: Number.isFinite(slot.plant.staminaMax) ? slot.plant.staminaMax : 0,
            tired: Boolean(slot.plant.tired),
            buffed: Boolean(slot.plant.buffed),
          }
        : null;

      return {
        index: Number(slot.index),
        laneIndex: Number(slot.laneIndex),
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

function normalizeSunPickups(sunPickups) {
  if (!Array.isArray(sunPickups)) {
    return [];
  }

  return sunPickups
    .map((pickup) => {
      if (!pickup || typeof pickup !== 'object') {
        return null;
      }

      return {
        id: String(pickup.id ?? ''),
        laneIndex: Number(pickup.laneIndex),
        x: Number(pickup.x),
        y: Number(pickup.y),
        amount: Number(pickup.amount),
      };
    })
    .filter((pickup) =>
      pickup
      && pickup.id
      && Number.isFinite(pickup.x)
      && Number.isFinite(pickup.y)
      && Number.isFinite(pickup.amount),
    );
}

function normalizePlantMatterPickups(plantMatterPickups) {
  if (!Array.isArray(plantMatterPickups)) {
    return [];
  }

  return plantMatterPickups
    .map((pickup) => {
      if (!pickup || typeof pickup !== 'object') {
        return null;
      }

      return {
        id: String(pickup.id ?? ''),
        laneIndex: Number(pickup.laneIndex),
        x: Number(pickup.x),
        y: Number(pickup.y),
        amount: Number(pickup.amount),
      };
    })
    .filter((pickup) =>
      pickup
      && pickup.id
      && Number.isFinite(pickup.x)
      && Number.isFinite(pickup.y)
      && Number.isFinite(pickup.amount),
    );
}

function normalizePlantDefs(plantDefs) {
  if (!plantDefs || typeof plantDefs !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(plantDefs)
      .filter(([type]) => typeof type === 'string' && type.length > 0)
      .map(([type, def]) => [
        type,
        {
          cost: Number(def?.cost),
          label: typeof def?.label === 'string' && def.label ? def.label : type,
        },
      ])
      .filter(([, def]) => Number.isFinite(def.cost)),
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

export function connectOnePlayer({ playerId }) {
  const activeSocket = createSocket();
  const normalizedPlayerId = toStringId(playerId);

  if (!normalizedPlayerId) {
    return activeSocket;
  }

  activeSocket.once('connect', () => {
    activeSocket.emit('join_one_player_room', { playerId: normalizedPlayerId });
  });

  if (!activeSocket.connected) {
    activeSocket.connect();
    return activeSocket;
  }

  activeSocket.emit('join_one_player_room', { playerId: normalizedPlayerId });
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

export function emitCollectSun({ roomId, playerId, sunId, x, y }) {
  if (!socket) {
    return;
  }

  const normalizedRoomId = toStringId(roomId);
  const normalizedPlayerId = toStringId(playerId);
  const normalizedSunId = toStringId(sunId);

  if (!normalizedRoomId || !normalizedPlayerId || !normalizedSunId) {
    return;
  }

  socket.emit('collect_sun', {
    roomId: normalizedRoomId,
    playerId: normalizedPlayerId,
    sunId: normalizedSunId,
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
  });
}

export function emitCollectPlantMatter({ roomId, playerId, matterId, x, y }) {
  if (!socket) {
    return;
  }

  const normalizedRoomId = toStringId(roomId);
  const normalizedPlayerId = toStringId(playerId);
  const normalizedMatterId = toStringId(matterId);

  if (!normalizedRoomId || !normalizedPlayerId || !normalizedMatterId) {
    return;
  }

  socket.emit('collect_plant_matter', {
    roomId: normalizedRoomId,
    playerId: normalizedPlayerId,
    matterId: normalizedMatterId,
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
  });
}

// Fired when the player drags the repair handle onto a plant's slot. The
// server decides repair-vs-buff itself (see useMatterOnPlant in
// defaultGameEngine.ts) based on whether that plant is currently tired - the
// client just names the target.
export function emitUseMatterOnPlant({ roomId, playerId, slotIndex }) {
  if (!socket) {
    return;
  }

  const normalizedRoomId = toStringId(roomId);
  const normalizedPlayerId = toStringId(playerId);
  const normalizedSlotIndex = toFiniteNumber(slotIndex);

  if (!normalizedRoomId || !normalizedPlayerId || normalizedSlotIndex === null) {
    return;
  }

  socket.emit('use_plant_matter', {
    roomId: normalizedRoomId,
    playerId: normalizedPlayerId,
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

export function onActionRejected(listener) {
  actionRejectedListeners.add(listener);
  return () => actionRejectedListeners.delete(listener);
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