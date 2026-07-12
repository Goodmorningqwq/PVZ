import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Initialize Express and HTTP server
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configuration
const PORT = process.env.PORT || 3000;
const TICK_RATE = parseInt(process.env.TICK_RATE || '15');
const MAX_CONCURRENT_MATCHES = parseInt(process.env.MAX_CONCURRENT_MATCHES || '50');

// Logger utility
const log = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, data || '');
};

// Game state management
interface Player {
  id: string;
  name: string;
  socketId: string;
}

interface Match {
  id: string;
  playerA: Player;
  playerB: Player;
  wave: number;
  tick: number;
  playerA_sun: number;
  playerB_sun: number;
  playerA_board: any[];
  playerB_board: any[];
  zombies: any[];
  gameStatus: 'WAITING' | 'PLAYING' | 'ENDED';
  winner?: string;
}

const matches = new Map<string, Match>();
const playerToMatch = new Map<string, string>();

// Helper functions
function createMatch(playerA: Player, playerB: Player): Match {
  return {
    id: uuidv4(),
    playerA,
    playerB,
    wave: 0,
    tick: 0,
    playerA_sun: 50,
    playerB_sun: 50,
    playerA_board: [],
    playerB_board: [],
    zombies: [],
    gameStatus: 'PLAYING'
  };
}

function broadcastToMatch(matchId: string, event: string, data: any) {
  const match = matches.get(matchId);
  if (match) {
    io.to(match.playerA.socketId).emit(event, data);
    io.to(match.playerB.socketId).emit(event, data);
  }
}

// Express middleware
app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint (for keep-alive)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    matches: matches.size
  });
});

// Get server stats
app.get('/api/stats', (req, res) => {
  res.json({
    activeMatches: matches.size,
    connectedPlayers: io.engine.clientsCount,
    maxConcurrentMatches: MAX_CONCURRENT_MATCHES,
    tickRate: TICK_RATE,
    uptime: process.uptime()
  });
});

// Socket.io event handlers
io.on('connection', (socket) => {
  log('INFO', `Player connected: ${socket.id}`);

  // Player joins a room/match
  socket.on('join_room', (data: { roomId: string; playerName: string }, callback) => {
    const { roomId, playerName } = data;

    try {
      const player: Player = {
        id: uuidv4(),
        name: playerName,
        socketId: socket.id
      };

      socket.join(roomId);

      // Check if room already has players
      const playersInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;

      if (playersInRoom === 1) {
        // First player joins
        socket.data = { player, roomId, isPlayerA: true };
        log('INFO', `Player A joined room ${roomId}: ${playerName}`);
        callback({ success: true, message: 'Waiting for opponent...' });
      } else if (playersInRoom === 2) {
        // Second player joins - start match
        socket.data = { player, roomId, isPlayerB: true };

        const sockets = Array.from(io.sockets.adapter.rooms.get(roomId)?.values() || []);
        if (sockets.length === 2) {
          const playerASocket = io.sockets.sockets.get(sockets[0]);
          const playerBSocket = io.sockets.sockets.get(sockets[1]);

          if (playerASocket?.data && playerBSocket?.data) {
            const playerA = playerASocket.data.player;
            const playerB = playerBSocket.data.player;

            const match = createMatch(playerA, playerB);
            matches.set(match.id, match);
            playerToMatch.set(playerA.id, match.id);
            playerToMatch.set(playerB.id, match.id);

            // Notify both players
            io.to(roomId).emit('match_found', {
              matchId: match.id,
              playerA: { id: playerA.id, name: playerA.name },
              playerB: { id: playerB.id, name: playerB.name },
              startTime: new Date().toISOString()
            });

            log('INFO', `Match created: ${match.id} (${playerA.name} vs ${playerB.name})`);
          }
        }
        callback({ success: true, message: 'Match started!' });
      } else {
        callback({ success: false, message: 'Room is full' });
      }
    } catch (error) {
      log('ERROR', 'Error joining room', error);
      callback({ success: false, message: 'Error joining room' });
    }
  });

  // Player places a plant
  socket.on('place_plant', (data: { matchId: string; plant: string; x: number; y: number }, callback) => {
    const { matchId, plant, x, y } = data;
    const match = matches.get(matchId);

    if (!match) {
      callback({ success: false, message: 'Match not found' });
      return;
    }

    try {
      // Determine which player is placing
      const isPlayerA = socket.data?.player?.id === match.playerA.id;
      const playerBoard = isPlayerA ? match.playerA_board : match.playerB_board;
      const playerSun = isPlayerA ? match.playerA_sun : match.playerB_sun;

      // Simple plant cost (would be in a config file in production)
      const PLANT_COSTS: Record<string, number> = {
        peashooter: 100,
        sunflower: 50
      };

      const cost = PLANT_COSTS[plant] || 100;

      // Validate placement
      if (playerSun < cost) {
        callback({ success: false, message: 'Not enough sun' });
        return;
      }

      // Check if tile is empty
      const tileOccupied = playerBoard.some((p: any) => p.x === x && p.y === y);
      if (tileOccupied) {
        callback({ success: false, message: 'Tile occupied' });
        return;
      }

      // Add plant to board
      const plantData = {
        id: uuidv4(),
        type: plant,
        x,
        y,
        health: 100,
        createdAt: new Date().toISOString()
      };

      playerBoard.push(plantData);

      // Deduct sun
      if (isPlayerA) {
        match.playerA_sun -= cost;
      } else {
        match.playerB_sun -= cost;
      }

      // Broadcast to both players
      broadcastToMatch(matchId, 'plant_placed', {
        playerId: socket.data.player.id,
        plant,
        x,
        y,
        playerName: socket.data.player.name
      });

      callback({ success: true, message: 'Plant placed' });
      log('INFO', `Plant placed in match ${matchId}: ${plant} at (${x}, ${y})`);
    } catch (error) {
      log('ERROR', 'Error placing plant', error);
      callback({ success: false, message: 'Error placing plant' });
    }
  });

  // Player removes a plant
  socket.on('remove_plant', (data: { matchId: string; plantId: string }, callback) => {
    const { matchId, plantId } = data;
    const match = matches.get(matchId);

    if (!match) {
      callback({ success: false, message: 'Match not found' });
      return;
    }

    try {
      const isPlayerA = socket.data?.player?.id === match.playerA.id;
      const playerBoard = isPlayerA ? match.playerA_board : match.playerB_board;

      const plantIndex = playerBoard.findIndex((p: any) => p.id === plantId);
      if (plantIndex === -1) {
        callback({ success: false, message: 'Plant not found' });
        return;
      }

      playerBoard.splice(plantIndex, 1);

      broadcastToMatch(matchId, 'plant_removed', {
        playerId: socket.data.player.id,
        plantId
      });

      callback({ success: true, message: 'Plant removed' });
    } catch (error) {
      log('ERROR', 'Error removing plant', error);
      callback({ success: false, message: 'Error removing plant' });
    }
  });

  // Player disconnects
  socket.on('disconnect', () => {
    log('INFO', `Player disconnected: ${socket.id}`);

    const matchId = Array.from(playerToMatch.values()).find(
      id => matches.get(id)?.playerA.socketId === socket.id || matches.get(id)?.playerB.socketId === socket.id
    );

    if (matchId) {
      const match = matches.get(matchId);
      if (match) {
        // Notify opponent
        const opponentSocketId = socket.id === match.playerA.socketId ? match.playerB.socketId : match.playerA.socketId;
        io.to(opponentSocketId).emit('opponent_disconnected', {
          matchId,
          message: 'Opponent disconnected'
        });

        // Clean up match after 30 seconds
        setTimeout(() => {
          matches.delete(matchId);
          playerToMatch.delete(match.playerA.id);
          playerToMatch.delete(match.playerB.id);
          log('INFO', `Match cleaned up: ${matchId}`);
        }, 30000);
      }
    }
  });
});

// Game loop (tick-based updates)
setInterval(() => {
  matches.forEach((match, matchId) => {
    if (match.gameStatus !== 'PLAYING') return;

    match.tick++;

    // Simulate zombie movement (placeholder)
    // In production, this would contain actual game logic

    // Broadcast game state to both players
    broadcastToMatch(matchId, 'game_tick', {
      tick: match.tick,
      wave: match.wave,
      playerA_sun: match.playerA_sun,
      playerB_sun: match.playerB_sun,
      zombies: match.zombies,
      timestamp: new Date().toISOString()
    });

    // Check win conditions (placeholder)
    // In production, check if lawn is breached, all zombies dead, etc.
  });
}, 1000 / TICK_RATE); // 1000ms / TICK_RATE = interval

// Error handling
process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', error);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled rejection', { reason, promise });
});

// Start server
httpServer.listen(PORT, () => {
  log('INFO', `Server is running on port ${PORT}`);
  log('INFO', `Tick rate: ${TICK_RATE} ticks/second`);
  log('INFO', `Max concurrent matches: ${MAX_CONCURRENT_MATCHES}`);
  log('INFO', `Health check: http://localhost:${PORT}/api/health`);
});

export default httpServer;
