import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = Number(process.env.PORT || 3000);
const TICK_RATE = Number(process.env.TICK_RATE || 15);

// --- Board layout -----------------------------------------------------
// Single shared lane, 8 fixed slots. Coordinates match the frontend's fixed
// logical resolution (GAME_WIDTH=800, GAME_HEIGHT=400) — see
// frontend/src/scenes/GameScene/constants.js. Either player may place into
// any open slot (fully shared placement, per design discussion).
const BOARD_WIDTH = 800;
const LANE_Y = 200;
const SLOT_COUNT = 8;
const SLOT_MARGIN = 48;
const SLOT_SPACING = (BOARD_WIDTH - SLOT_MARGIN * 2) / SLOT_COUNT;
const ZOMBIE_SPAWN_X = BOARD_WIDTH - 20;
const LAWN_BREACH_X = 0;

function buildSlots(): SlotState[] {
  const slots: SlotState[] = [];
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    slots.push({
      index: i,
      x: Math.round(SLOT_MARGIN + SLOT_SPACING * (i + 0.5)),
      y: LANE_Y,
      plant: null,
    });
  }
  return slots;
}

// --- Plants -------------------------------------------------------------
// Numbers are a first playable pass, not final balance (tuning comes later).
const PLANT_DEFS = {
  peashooter: {
    cost: 100,
    hp: 100,
    damage: 20,
    cooldownTicks: Math.round(1.4 * TICK_RATE),
  },
  sunflower: {
    cost: 50,
    hp: 100,
    sunAmount: 25,
    intervalTicks: Math.round(24 * TICK_RATE),
  },
} as const;

type PlantType = keyof typeof PLANT_DEFS;

// --- Zombies / waves ------------------------------------------------------
// Speed and starting sun were tuned down/up after playtesting showed wave 1
// was unwinnable: a peashooter (100 sun) was unaffordable with 50 starting
// sun (no combining between purses), and a sunflower's ~24s first payout
// roughly matched the time a zombie took to cross the board, leaving no
// window to build any defense before the wave arrived.
const ZOMBIE_HP = 20;
const ZOMBIE_SPEED = 1; // px/tick (was 2 — halved so a full crossing takes ~52s instead of ~26s)
const ZOMBIE_CHOMP_DAMAGE = 20;
const ZOMBIE_CHOMP_INTERVAL_TICKS = TICK_RATE; // one chomp per second of contact

const WAVES = [
  { count: 3, spawnIntervalTicks: 6 * TICK_RATE },
  { count: 5, spawnIntervalTicks: 5 * TICK_RATE },
  { count: 7, spawnIntervalTicks: 4 * TICK_RATE },
];
const WAVE_BREAK_TICKS = 8 * TICK_RATE;
const PRE_GAME_DELAY_TICKS = 6 * TICK_RATE; // was 3s — more time to place a first plant before zombies start moving
const STARTING_SUN = 150; // was 50 — now enough for one player to afford a peashooter (100) immediately

type WaveStatus = 'pending' | 'spawning' | 'break' | 'complete';

type PlayerState = {
  playerId: string;
  socketId: string;
};

type SlotPlant = {
  type: PlantType;
  hp: number;
  ownerId: string;
  cooldown: number; // peashooter: ticks until next shot
  sunTimer: number; // sunflower: ticks until next income proc
};

type SlotState = {
  index: number;
  x: number;
  y: number;
  plant: SlotPlant | null;
};

type ZombieState = {
  id: string;
  x: number;
  y: number;
  hp: number;
  chompCooldown: number;
};

type RoomState = {
  roomId: string;
  players: PlayerState[];
  slots: SlotState[];
  zombies: ZombieState[];
  sun: Record<string, number>;
  tick: number;
  gameOver: boolean;
  result?: 'win' | 'lose';
  waveIndex: number; // -1 before the first wave starts
  waveStatus: WaveStatus;
  waveTimer: number;
  zombiesSpawnedInWave: number;
};

const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();

function log(level: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, data ?? '');
}

function sanitizeId(value: unknown): string {
  return String(value ?? '').trim();
}

function getOrCreateRoom(roomId: string): RoomState {
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom;
  }

  const createdRoom: RoomState = {
    roomId,
    players: [],
    slots: buildSlots(),
    zombies: [],
    sun: {},
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

function emitRoomJoined(room: RoomState) {
  const [playerA, playerB] = room.players;
  if (!playerA || !playerB) {
    return;
  }

  io.to(playerA.socketId).emit('room_joined', {
    roomId: room.roomId,
    playerId: playerA.playerId,
    opponentId: playerB.playerId,
  });

  io.to(playerB.socketId).emit('room_joined', {
    roomId: room.roomId,
    playerId: playerB.playerId,
    opponentId: playerA.playerId,
  });
}

function serializeSlots(room: RoomState) {
  return room.slots.map((slot) => ({
    index: slot.index,
    x: slot.x,
    y: slot.y,
    plant: slot.plant
      ? {
          type: slot.plant.type,
          hp: slot.plant.hp,
          ownerId: slot.plant.ownerId,
        }
      : null,
  }));
}

function broadcastState(room: RoomState) {
  io.to(room.roomId).emit('state_update', {
    tick: room.tick,
    slots: serializeSlots(room),
    zombies: room.zombies.map((zombie) => ({ id: zombie.id, x: zombie.x, y: zombie.y, hp: zombie.hp })),
    sun: { ...room.sun },
    wave: room.waveIndex + 1, // 1-based for display; 0 while still pending
    waveStatus: room.waveStatus,
    totalWaves: WAVES.length,
  });
}

function endGame(room: RoomState, result: 'win' | 'lose') {
  if (room.gameOver) {
    return;
  }

  room.gameOver = true;
  room.result = result;
  io.to(room.roomId).emit('game_over', {
    result,
    reason: result === 'win' ? 'all_waves_cleared' : 'lawn_breached',
  });
}

function spawnZombie(room: RoomState) {
  room.zombies.push({
    id: `z-${uuidv4()}`,
    x: ZOMBIE_SPAWN_X,
    y: LANE_Y,
    hp: ZOMBIE_HP,
    chompCooldown: 0,
  });
}

function advanceWaveState(room: RoomState) {
  if (room.waveStatus === 'pending') {
    room.waveTimer -= 1;
    if (room.waveTimer <= 0) {
      room.waveIndex = 0;
      room.waveStatus = 'spawning';
      room.zombiesSpawnedInWave = 0;
      room.waveTimer = 0;
    }
    return;
  }

  if (room.waveStatus === 'spawning') {
    const wave = WAVES[room.waveIndex];

    if (room.zombiesSpawnedInWave < wave.count) {
      if (room.waveTimer <= 0) {
        spawnZombie(room);
        room.zombiesSpawnedInWave += 1;
        room.waveTimer = wave.spawnIntervalTicks;
      } else {
        room.waveTimer -= 1;
      }
      return;
    }

    // All zombies for this wave have spawned — wave clears once they're all dead.
    if (room.zombies.length === 0) {
      if (room.waveIndex + 1 >= WAVES.length) {
        room.waveStatus = 'complete';
        endGame(room, 'win');
        return;
      }
      room.waveStatus = 'break';
      room.waveTimer = WAVE_BREAK_TICKS;
    }
    return;
  }

  if (room.waveStatus === 'break') {
    room.waveTimer -= 1;
    if (room.waveTimer <= 0) {
      room.waveIndex += 1;
      room.waveStatus = 'spawning';
      room.zombiesSpawnedInWave = 0;
      room.waveTimer = 0;
    }
  }
}

function advanceEconomy(room: RoomState) {
  for (const slot of room.slots) {
    if (!slot.plant || slot.plant.type !== 'sunflower') {
      continue;
    }

    slot.plant.sunTimer -= 1;
    if (slot.plant.sunTimer <= 0) {
      const def = PLANT_DEFS.sunflower;
      // Shared income: every sunflower proc benefits both players' purses,
      // not just the owner's (see design discussion — economy is
      // cooperative even though purses are tracked separately).
      for (const player of room.players) {
        room.sun[player.playerId] = (room.sun[player.playerId] ?? 0) + def.sunAmount;
      }
      slot.plant.sunTimer = def.intervalTicks;
    }
  }
}

function advanceCombat(room: RoomState) {
  for (const slot of room.slots) {
    if (!slot.plant || slot.plant.type !== 'peashooter') {
      continue;
    }

    slot.plant.cooldown -= 1;
    if (slot.plant.cooldown > 0) {
      continue;
    }

    // Nearest zombie at or ahead of this slot (single shared lane, so
    // "ahead" just means a larger x — zombies walk from high x to low x).
    let target: ZombieState | null = null;
    for (const zombie of room.zombies) {
      if (zombie.x < slot.x) {
        continue;
      }
      if (!target || zombie.x < target.x) {
        target = zombie;
      }
    }

    if (!target) {
      continue;
    }

    target.hp -= PLANT_DEFS.peashooter.damage;
    slot.plant.cooldown = PLANT_DEFS.peashooter.cooldownTicks;
  }

  room.zombies = room.zombies.filter((zombie) => zombie.hp > 0);
}

function advanceZombies(room: RoomState) {
  for (const zombie of room.zombies) {
    const blockingSlot = room.slots.find(
      (slot) => slot.plant && Math.abs(slot.x - zombie.x) < ZOMBIE_SPEED,
    );

    if (blockingSlot) {
      zombie.x = blockingSlot.x;
      zombie.chompCooldown -= 1;
      if (zombie.chompCooldown <= 0 && blockingSlot.plant) {
        blockingSlot.plant.hp -= ZOMBIE_CHOMP_DAMAGE;
        zombie.chompCooldown = ZOMBIE_CHOMP_INTERVAL_TICKS;
        if (blockingSlot.plant.hp <= 0) {
          blockingSlot.plant = null;
        }
      }
      continue;
    }

    zombie.chompCooldown = 0;

    const nextX = zombie.x - ZOMBIE_SPEED;
    // If a plant sits between the zombie's current and next position, stop
    // at that slot this tick instead of overshooting it.
    const passedSlot = room.slots.find((slot) => slot.plant && slot.x <= zombie.x && slot.x > nextX);
    zombie.x = passedSlot ? passedSlot.x : nextX;
  }
}

function checkLawnBreach(room: RoomState) {
  if (room.zombies.some((zombie) => zombie.x <= LAWN_BREACH_X)) {
    endGame(room, 'lose');
  }
}

function advanceRoom(room: RoomState) {
  if (room.gameOver || room.players.length < 2) {
    return;
  }

  room.tick += 1;

  advanceWaveState(room);
  advanceEconomy(room);
  advanceCombat(room);
  advanceZombies(room);
  checkLawnBreach(room);

  broadcastState(room);
}

function placePlant(room: RoomState, playerId: string, plantType: PlantType, slotIndex: number) {
  const slot = room.slots[slotIndex];
  if (!slot) {
    return { success: false, message: 'Invalid slot' };
  }

  if (slot.plant) {
    return { success: false, message: 'Slot occupied' };
  }

  const def = PLANT_DEFS[plantType];
  const currentSun = room.sun[playerId] ?? 0;

  if (currentSun < def.cost) {
    return { success: false, message: 'Not enough sun' };
  }

  room.sun[playerId] = currentSun - def.cost;
  slot.plant = {
    type: plantType,
    hp: def.hp,
    ownerId: playerId,
    cooldown: plantType === 'peashooter' ? PLANT_DEFS.peashooter.cooldownTicks : 0,
    sunTimer: plantType === 'sunflower' ? PLANT_DEFS.sunflower.intervalTicks : 0,
  };

  return { success: true };
}

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: rooms.size,
  });
});

app.get('/api/stats', (_req, res) => {
  res.json({
    rooms: rooms.size,
    connectedPlayers: io.engine.clientsCount,
    tickRate: TICK_RATE,
    uptime: process.uptime(),
  });
});

io.on('connection', (socket: Socket) => {
  log('INFO', `Player connected: ${socket.id}`);

  socket.on('join_room', (data: { roomId?: string; playerId?: string }) => {
    const roomId = sanitizeId(data?.roomId);
    const playerId = sanitizeId(data?.playerId);

    if (!roomId || !playerId) {
      return;
    }

    const room = getOrCreateRoom(roomId);
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);

    const existingPlayer = room.players.find((player) => player.playerId === playerId);
    if (!existingPlayer) {
      room.players.push({ playerId, socketId: socket.id });
      room.sun[playerId] = room.sun[playerId] ?? STARTING_SUN;
    } else {
      existingPlayer.socketId = socket.id;
    }

    if (room.players.length === 2) {
      emitRoomJoined(room);
      broadcastState(room);
    }

    log('INFO', `Player joined room ${roomId}: ${playerId}`);
  });

  socket.on('place_plant', (data: { roomId?: string; playerId?: string; plant?: string; slotIndex?: number }) => {
    const roomId = sanitizeId(data?.roomId);
    const playerId = sanitizeId(data?.playerId);
    const plantType: PlantType | null = data?.plant === 'peashooter' || data?.plant === 'sunflower' ? data.plant : null;
    const slotIndex = Number(data?.slotIndex);

    const room = rooms.get(roomId);
    if (!room || room.gameOver || !plantType || !Number.isInteger(slotIndex)) {
      return;
    }

    const result = placePlant(room, playerId, plantType, slotIndex);
    if (!result.success) {
      return;
    }

    broadcastState(room);
    log('INFO', `Plant placed in room ${roomId}: ${playerId} placed ${plantType} in slot ${slotIndex}`);
  });

  socket.on('disconnect', () => {
    log('INFO', `Player disconnected: ${socket.id}`);

    const roomId = socketToRoom.get(socket.id);
    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socketToRoom.delete(socket.id);
      return;
    }

    room.players = room.players.filter((player) => player.socketId !== socket.id);
    socketToRoom.delete(socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomId);
    }
  });
});

setInterval(() => {
  rooms.forEach((room) => advanceRoom(room));
}, 1000 / TICK_RATE);

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', 'Unhandled rejection', reason);
});

httpServer.listen(PORT, () => {
  log('INFO', `Server is running on port ${PORT}`);
  log('INFO', `Tick rate: ${TICK_RATE} ticks/second`);
  log('INFO', `Health check: http://localhost:${PORT}/api/health`);
});

export default httpServer;
