import Phaser from 'phaser';
import './styles.css';
import { connect, disconnect, onGameOver, onRoomJoined } from './network';
import LobbyScene from './scenes/LobbyScene';
import GameScene from './scenes/GameScene/GameScene';

function getOrCreateSessionId() {
  const storageKey = 'pvz-session-id';

  try {
    const existingId = window.localStorage.getItem(storageKey);
    if (existingId) {
      return existingId;
    }

    const createdId = window.crypto?.randomUUID?.() || `session-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(storageKey, createdId);
    return createdId;
  } catch {
    return window.crypto?.randomUUID?.() || `session-${Math.random().toString(16).slice(2)}`;
  }
}

function getRoomIdFromUrl() {
  return new URLSearchParams(window.location.search).get('room') || '';
}

function isDemoModeEnabled() {
  const demoValue = new URLSearchParams(window.location.search).get('demo');
  return demoValue === '1' || demoValue === 'true';
}

const roomId = getRoomIdFromUrl();
const demoMode = isDemoModeEnabled();
const playerId = getOrCreateSessionId();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#18251a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [LobbyScene, GameScene],
});

game.registry.set('roomId', roomId);
game.registry.set('playerId', playerId);
game.registry.set('demoMode', demoMode);

if (demoMode) {
  game.scene.start('GameScene');
} else if (roomId) {
  connect({ roomId, playerId });
}

onRoomJoined((payload) => {
  if (payload?.roomId) {
    game.registry.set('roomId', String(payload.roomId));
  }

  if (payload?.playerId) {
    game.registry.set('playerId', String(payload.playerId));
  }

  if (payload?.opponentId) {
    game.registry.set('opponentId', String(payload.opponentId));
  }

  game.scene.stop('LobbyScene');
  game.scene.start('GameScene');
});

onGameOver((payload) => {
  const gameScene = game.scene.getScene('GameScene');
  if (gameScene?.scene?.isActive()) {
    gameScene.showGameOver(payload);
  }
});

window.addEventListener('beforeunload', () => {
  disconnect();
});