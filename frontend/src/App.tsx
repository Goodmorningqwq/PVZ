import React, { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { connect, disconnect, onGameOver, onRoomJoined } from './network';
import GameScene from './scenes/GameScene/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './scenes/GameScene/constants';
import RoomMenu from './RoomMenu';
import WaitingRoom from './WaitingRoom';
import './App.css';

type HudState = {
  tick: number;
  roomId: string;
  playerId: string;
  sunText: string;
  demoMode: boolean;
};

type Phase = 'menu' | 'waiting' | 'playing';

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
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [hud, setHud] = useState<HudState>(initialHud);
  const [linkCopied, setLinkCopied] = useState(false);

  const playerId = useMemo(() => getSearchParam('player') || getOrCreateSessionId(), []);
  const demoMode = useMemo(() => {
    const demoValue = getSearchParam('demo');
    return demoValue === '1' || demoValue === 'true';
  }, []);

  // roomId starts from the URL (so shared links still work) but is otherwise
  // controlled by the room menu below, not required to be hand-typed into the URL.
  const [activeRoomId, setActiveRoomId] = useState(() => getSearchParam('room'));
  const [phase, setPhase] = useState<Phase>(() => {
    if (demoMode) return 'playing';
    if (getSearchParam('room')) return 'waiting';
    return 'menu';
  });

  function joinRoom(roomId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url.toString());
    setActiveRoomId(roomId);
    setPhase('waiting');
  }

  function playDemo() {
    const url = new URL(window.location.href);
    url.searchParams.set('demo', '1');
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail silently,
      // the room code is still visible for manual sharing.
    }
  }

  // Socket lifecycle: connect as soon as a room is chosen, well before Phaser
  // ever mounts. The "waiting for opponent" screen is plain HTML (WaitingRoom)
  // rather than Phaser canvas text, so there's nothing to render until the
  // match actually starts.
  useEffect(() => {
    if (demoMode || phase === 'menu' || !activeRoomId) {
      return;
    }

    setSocketStatus('Connecting...');
    connect({ roomId: activeRoomId, playerId });

    const offRoomJoined = onRoomJoined((payload) => {
      const joinedRoomId = payload?.roomId ? String(payload.roomId) : activeRoomId;
      const joinedPlayerId = payload?.playerId ? String(payload.playerId) : playerId;

      setHud((current) => ({ ...current, roomId: joinedRoomId, playerId: joinedPlayerId }));
      setSocketStatus('Room joined');
      setConnected(true);
      setPhase('playing');
    });

    return () => {
      offRoomJoined();
      disconnect();
    };
    // Deliberately depends on (phase === 'menu') rather than `phase` itself:
    // this effect should stay connected across the waiting -> playing
    // transition, not tear down and reconnect when the match starts.
  }, [demoMode, phase === 'menu', activeRoomId, playerId]);

  // Phaser only mounts once there's actually a game to render: immediately
  // for demo mode, or once the opponent has joined for a live match.
  useEffect(() => {
    if (phase !== 'playing' || !containerRef.current) {
      return;
    }

    const roomId = activeRoomId;

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
      scene: [GameScene],
    });

    game.registry.set('roomId', roomId);
    game.registry.set('playerId', playerId);
    game.registry.set('demoMode', demoMode);
    setHud((current) => ({ ...current, roomId, playerId, demoMode }));

    if (demoMode) {
      setSocketStatus('Demo mode');
    }

    const offHudUpdate = (() => {
      const handler = (payload: { tick: number; sunText: string }) => {
        setHud((current) => ({ ...current, tick: payload.tick, sunText: payload.sunText }));
      };
      game.events.on('hud-update', handler);
      return () => game.events.off('hud-update', handler);
    })();

    const offGameOver = onGameOver((payload) => {
      const gameScene = game.scene.getScene('GameScene');
      if (gameScene?.scene?.isActive()) {
        gameScene.showGameOver(payload);
      }
    });

    return () => {
      offHudUpdate();
      offGameOver();
      game.destroy(true);
    };
  }, [phase, demoMode, playerId, activeRoomId]);

  if (phase === 'menu') {
    return <RoomMenu onJoin={joinRoom} onPlayDemo={playDemo} />;
  }

  if (phase === 'waiting') {
    return <WaitingRoom roomId={activeRoomId} statusText={socketStatus} />;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Plants vs Zombies - Multiplayer</h1>
        <p>
          {demoMode ? 'Demo mode' : `Room ${hud.roomId || activeRoomId}`}
          {' '}• Player {hud.playerId || playerId}
          {!demoMode && (
            <button className="copy-link-button" type="button" onClick={copyInviteLink}>
              {linkCopied ? 'Copied!' : 'Copy invite link'}
            </button>
          )}
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
