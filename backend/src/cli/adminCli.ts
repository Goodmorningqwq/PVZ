import readline from 'node:readline';
import { forceGameOver, spawnZombieInLane } from '../game/defaultGameEngine.js';
import { advanceTwoPlayerRoomTicks, setPlayerSun as setTwoPlayerPlayerSun } from '../game/twoPlayerGameEngine.js';
import { advanceOnePlayerRoomTicks, setPlayerSun as setOnePlayerPlayerSun } from '../game/onePlayerGameEngine.js';
import { advanceDemoRoomTicks, setPlayerSun as setDemoPlayerSun } from '../game/demoGameEngine.js';
import { getRoom, getRooms } from '../room/roomStore.js';

type AdminCliContext = {
  emitState: (roomId: string) => void;
  emitGameOver: (roomId: string) => void;
  log: (level: string, message: string, data?: unknown) => void;
};

function printHelp() {
  console.log([
    'Admin CLI commands:',
    '  help',
    '  rooms',
    '  room <roomId>',
    '  give-sun <roomId> <playerId> <amount>',
    '  spawn-zombie <roomId> <laneIndex>',
    '  advance <roomId> <ticks>',
    '  game-over <roomId> <win|lose>',
    '  exit',
  ].join('\n'));
}

function printRoom(roomId: string) {
  const room = getRoom(roomId);
  if (!room) {
    console.log(`Room not found: ${roomId}`);
    return;
  }

  console.log(JSON.stringify({
    roomId: room.roomId,
    players: room.players,
    sun: room.sun,
    tick: room.tick,
    gameOver: room.gameOver,
    result: room.result,
    waveIndex: room.waveIndex,
    waveStatus: room.waveStatus,
    waveTimer: room.waveTimer,
    zombies: room.zombies,
    projectiles: room.projectiles,
    sunPickups: room.sunPickups,
  }, null, 2));
}

function printRooms() {
  const rooms = Array.from(getRooms().values()).map((room) => ({
    roomId: room.roomId,
    players: room.players.map((player) => player.playerId),
    tick: room.tick,
    gameOver: room.gameOver,
    waveStatus: room.waveStatus,
    zombies: room.zombies.length,
    projectiles: room.projectiles.length,
  }));

  console.log(JSON.stringify(rooms, null, 2));
}

export function startAdminCli(context: AdminCliContext) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'pvz-admin> ',
  });

  printHelp();
  rl.prompt();

  rl.on('line', (line) => {
    const [command, ...args] = line.trim().split(/\s+/);

    try {
      switch (command) {
        case 'help':
          printHelp();
          break;
        case 'rooms':
          printRooms();
          break;
        case 'room': {
          const [roomId] = args;
          if (!roomId) {
            console.log('Usage: room <roomId>');
            break;
          }
          printRoom(roomId);
          break;
        }
        case 'give-sun': {
          const [roomId, playerId, amountText] = args;
          const amount = Number(amountText);
          const room = roomId ? getRoom(roomId) : null;
          if (!room || !playerId || !Number.isFinite(amount)) {
            console.log('Usage: give-sun <roomId> <playerId> <amount>');
            break;
          }
          if (room.mode === 'demo') {
            setDemoPlayerSun(room, playerId, amount);
          } else if (room.mode === 'onePlayer') {
            setOnePlayerPlayerSun(room, playerId, amount);
          } else {
            setTwoPlayerPlayerSun(room, playerId, amount);
          }
          context.emitState(roomId);
          console.log(`Set sun for ${playerId} in ${roomId} to ${Math.floor(amount)}`);
          break;
        }
        case 'spawn-zombie': {
          const [roomId, laneIndexText] = args;
          const laneIndex = Number(laneIndexText);
          const room = roomId ? getRoom(roomId) : null;
          if (!room || !Number.isFinite(laneIndex)) {
            console.log('Usage: spawn-zombie <roomId> <laneIndex>');
            break;
          }
          spawnZombieInLane(room, laneIndex);
          context.emitState(roomId);
          console.log(`Spawned zombie in ${roomId} lane ${Math.floor(laneIndex)}`);
          break;
        }
        case 'advance': {
          const [roomId, ticksText] = args;
          const ticks = Number(ticksText);
          const room = roomId ? getRoom(roomId) : null;
          if (!room || !Number.isFinite(ticks)) {
            console.log('Usage: advance <roomId> <ticks>');
            break;
          }
          if (room.mode === 'demo') {
            advanceDemoRoomTicks(room, ticks);
          } else if (room.mode === 'onePlayer') {
            advanceOnePlayerRoomTicks(room, ticks);
          } else {
            advanceTwoPlayerRoomTicks(room, ticks);
          }
          context.emitState(roomId);
          context.emitGameOver(roomId);
          console.log(`Advanced ${roomId} by ${Math.floor(ticks)} ticks`);
          break;
        }
        case 'game-over': {
          const [roomId, result] = args;
          const room = roomId ? getRoom(roomId) : null;
          if (!room || (result !== 'win' && result !== 'lose')) {
            console.log('Usage: game-over <roomId> <win|lose>');
            break;
          }
          forceGameOver(room, result);
          context.emitGameOver(roomId);
          console.log(`Marked ${roomId} as ${result}`);
          break;
        }
        case 'exit':
          rl.close();
          return;
        case '':
          break;
        default:
          console.log(`Unknown command: ${command}`);
          printHelp();
      }
    } catch (error) {
      context.log('ERROR', 'Admin CLI command failed', error);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('Admin CLI closed');
  });
}