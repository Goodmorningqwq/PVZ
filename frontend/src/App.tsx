import React, { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { connect, disconnect, onGameOver, onRoomJoined } from './network';
import LobbyScene from './scenes/LobbyScene';
import GameScene from './scenes/GameScene/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './scenes/GameScene/constants';
import './App.css';

type HudState = {
  tick: number;
  roomId: string;
  playerId: string;
  sunText: string;
  demoMode: boolean;
};

const initialHud: HudState = { tick: 0, roomId: '', playerId: '', sunText: '', demoMode: false };

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
  const [hud, setHud] = useState<HudState>(initialHud);

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
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      },
      scene: [LobbyScene, GameScene],
    });

    game.registry.set('roomId', roomId);
    game.registry.set('playerId', playerId);
    game.registry.set('demoMode', demoMode);
    setHud((current) => ({ ...current, roomId, playerId, demoMode }));

    const offHudUpdate = (() => {
      const handler = (payload: { tick: number; sunText: string }) => {
        setHud((current) => ({ ...current, tick: payload.tick, sunText: payload.sunText }));
      };
      game.events.on('hud-update', handler);
      return () => game.events.off('hud-update', handler);
    })();

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
      const joinedRoomId = payload?.roomId ? String(payload.roomId) : roomId;
      const joinedPlayerId = payload?.playerId ? String(payload.playerId) : playerId;

      if (payload?.roomId) {
        game.registry.set('roomId', joinedRoomId);
      }

      if (payload?.playerId) {
        game.registry.set('playerId', joinedPlayerId);
      }

      if (payload?.opponentId) {
        game.registry.set('opponentId', String(payload.opponentId));
      }

      setHud((current) => ({ ...current, roomId: joinedRoomId, playerId: joinedPlayerId }));
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
      offHudUpdate();
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
          {demoMode ? 'Demo mode' : (hud.roomId || roomId) ? `Room ${hud.roomId || roomId}` : 'No room code in the URL'}
          {' '}• Player {hud.playerId || playerId}
        </p>
        <p>Status: {socketStatus} {connected ? '• connected' : '• disconnected'}</p>
      </div>
      <div className="game-stage">
        <div ref={containerRef} className="game-canvas" />
        <div className="hud-overlay">
          <span className={`mode-badge ${hud.demoMode ? 'mode-badge--demo' : 'mode-badge--live'}`}>
            {hud.demoMode ? 'DEMO' : 'LIVE'}
          </span>
          <span className="hud-line">Tick {hud.tick}</span>
          <span className="hud-line">{hud.sunText || 'No sun data yet'}</span>
        </div>
        <div className="hud-hint">Click anywhere on the lane to place a peashooter.</div>
      </div>
    </div>
  );
}
