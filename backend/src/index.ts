import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { createApiRouter } from './controllers/httpController.js';
import { registerSocketHandlers } from './controllers/socketController.js';
import { createRoomEvents } from './services/roomEvents.js';
import { startGameLoop } from './services/gameLoop.js';
import { startAdminCli } from './cli/adminCli.js';
import { log } from './utils/logger.js';
import { TICK_RATE } from './game/config/gameConfig.js';

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

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/api', createApiRouter(io, TICK_RATE));

const roomEvents = createRoomEvents(io);
registerSocketHandlers(io, roomEvents);
startGameLoop(TICK_RATE, roomEvents);

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

startAdminCli({
  emitState: roomEvents.emitState,
  emitGameOver: roomEvents.maybeEmitGameOver,
  log,
});

export default httpServer;
