import React, { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { connect, disconnect, onGameOver, onRoomJoined } from './network';
import LobbyScene from './scenes/LobbyScene';
import GameScene from './scenes/GameScene/GameScene';
import './App.css';

function getSearchParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

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

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Initializing...');

  const roomId = useMemo(() => getSearchParam('room'), []);
  const playerId = useMemo(() => getSearchParam('player') || getOrCreateSessionId(), []);
  const demoMode = useMemo(() => {
    const demoValue = getSearchParam('demo');
    return demoValue === '1' || demoValue === 'true';
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
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
      setSocketStatus('Demo mode');
    } else if (roomId) {
      connect({ roomId, playerId });
      setSocketStatus('Connecting...');
    } else {
      setSocketStatus('Waiting for room code');
    }

    const offRoomJoined = onRoomJoined((payload) => {
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
      setSocketStatus('Room joined');
      setConnected(true);
    });

    const offGameOver = onGameOver((payload) => {
      const gameScene = game.scene.getScene('GameScene');
      if (gameScene?.scene?.isActive()) {
        gameScene.showGameOver(payload);
      }
    });

    return () => {
      offRoomJoined();
      offGameOver();
      disconnect();
      game.destroy(true);
    };
  }, [demoMode, playerId, roomId]);

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Plants vs Zombies - Multiplayer</h1>
        <p>
          {demoMode ? 'Demo mode' : roomId ? `Room ${roomId}` : 'No room code in the URL'}
          {' '}• Player {playerId}
        </p>
        <p>Status: {socketStatus} {connected ? '• connected' : '• disconnected'}</p>
      </div>
      <div ref={containerRef} className="game-canvas" />
    </div>
  );
}
