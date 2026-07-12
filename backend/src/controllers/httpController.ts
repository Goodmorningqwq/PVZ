import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { getRoomCount } from '../room/roomStore';

export function createApiRouter(io: SocketIOServer, tickRate: number): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rooms: getRoomCount(),
    });
  });

  router.get('/stats', (_req, res) => {
    res.json({
      rooms: getRoomCount(),
      connectedPlayers: io.engine.clientsCount,
      tickRate,
      uptime: process.uptime(),
    });
  });

  return router;
}
