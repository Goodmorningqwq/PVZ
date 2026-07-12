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
const TICK_RATE = Number(process.env.TICK_RATE || 10);

const PLANT_COSTS: Record<string, number> = {
  peashooter: 100,
  sunflower: 50,
  wallnut: 50,
};

const BOARD_WIDTH = 800;
const ZOMBIE_SPEED = 10;

type PlayerState = {
  playerId: string;
  socketId: string;
};

type TowerState = {
  id: string;
  x: number;
  y: number;
  type: string;
  owner: string;
  hp: number;
};

type ZombieState = {
  id: string;
  x: number;
  y: number;
  hp: number;
};

type RoomState = {
  roomId: string;
  players: PlayerState[];
  towers: TowerState[];
  zombies: ZombieState[];
  sun: Record<string, number>;
  tick: number;
  gameOver: boolean;
  winnerId?: string;
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
    towers: [],
    zombies: [{ id: `z-${uuidv4()}`, x: BOARD_WIDTH - 60, y: 180, hp: 20 }],
    sun: {},
    tick: 0,
    gameOver: false,
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

function broadcastState(room: RoomState) {
  io.to(room.roomId).emit('state_update', {
    tick: room.tick,
    towers: room.towers.map((tower) => ({ ...tower })),
    zombies: room.zombies.map((zombie) => ({ ...zombie })),
    sun: { ...room.sun },
  });
}

function endGame(room: RoomState, winnerId: string) {
  if (room.gameOver) {
    return;
  }

  room.gameOver = true;
  room.winnerId = winnerId;
  io.to(room.roomId).emit('game_over', {
    winnerId,
    reason: 'opponent_lawn_breached',
  });
}

function advanceRoom(room: RoomState) {
  if (room.gameOver || room.players.length < 2) {
    return;
  }

  room.tick += 1;

  for (const player of room.players) {
    room.sun[player.playerId] = (room.sun[player.playerId] ?? 50) + 1;
  }

  for (const zombie of room.zombies) {
    zombie.x -= ZOMBIE_SPEED;
  }

  if (room.zombies.some((zombie) => zombie.x <= 0)) {
    endGame(room, room.players[0]?.playerId || room.players[1]?.playerId || 'unknown');
  }

  broadcastState(room);
}

function placePlant(room: RoomState, playerId: string, x: number, y: number) {
  const cost = PLANT_COSTS.peashooter;
  const currentSun = room.sun[playerId] ?? 0;

  if (currentSun < cost) {
    return { success: false, message: 'Not enough sun' };
  }

  if (room.towers.some((tower) => tower.x === x && tower.y === y)) {
    return { success: false, message: 'Tile occupied' };
  }

  room.sun[playerId] = currentSun - cost;
  room.towers.push({
    id: `t-${uuidv4()}`,
    x,
    y,
    type: 'peashooter',
    owner: playerId,
    hp: 100,
  });

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
      room.sun[playerId] = room.sun[playerId] ?? 50;
    } else {
      existingPlayer.socketId = socket.id;
    }

    if (room.players.length === 2) {
      emitRoomJoined(room);
      broadcastState(room);
    }

    log('INFO', `Player joined room ${roomId}: ${playerId}`);
  });

  socket.on('place_plant', (data: { roomId?: string; playerId?: string; x?: number; y?: number }) => {
    const roomId = sanitizeId(data?.roomId);
    const playerId = sanitizeId(data?.playerId);
    const x = Number(data?.x);
    const y = Number(data?.y);

    const room = rooms.get(roomId);
    if (!room || !Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const result = placePlant(room, playerId, x, y);
    if (!result.success) {
      return;
    }

    broadcastState(room);
    log('INFO', `Plant placed in room ${roomId}: ${playerId} @ (${x}, ${y})`);
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
