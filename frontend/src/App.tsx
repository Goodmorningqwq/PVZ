import React, { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { connect, disconnect, onGameOver, onRoomJoined } from './network';
import GameScene from './scenes/GameScene/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './scenes/GameScene/constants';
import RoomMenu from './RoomMenu';
import WaitingRoom from './WaitingRoom';
import ShopBar from './ShopBar';
import './App.css';

type HudState = {
  tick: number;
  roomId: string;
  playerId: string;
  sun: Record<string, number>;
  demoMode: boolean;
  wave: number;
  waveStatus: string;
  totalWaves: number;
};

type GameOverInfo = {
  result: 'win' | 'lose';
  reason: string;
};

type Phase = 'menu' | 'waiting' | 'playing';

const initialHud: HudState = {
  tick: 0,
  roomId: '',
  playerId: '',
  sun: {},
  demoMode: false,
  wave: 0,
  waveStatus: 'pending',
  totalWaves: 0,
};

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

// Session IDs are long UUIDs meant for the wire, not for a human to read.
// Shorten them for display until real display names exist.
function shortId(id: string) {
  return id ? id.slice(0, 8) : '';
}

function waveStatusLabel(waveStatus: string, wave: number, totalWaves: number) {
  if (waveStatus === 'pending') return 'Get ready...';
  if (waveStatus === 'break') return `Wave ${wave} cleared — next wave incoming...`;
  if (waveStatus === 'complete') return 'All waves cleared!';
  if (totalWaves > 0) return `Wave ${wave} / ${totalWaves}`;
  return `Wave ${wave}`;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [hud, setHud] = useState<HudState>(initialHud);
  const [linkCopied, setLinkCopied] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);

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

  function backToMenu() {
    window.location.href = window.location.pathname;
  }

  function selectPlant(plantType: string) {
    setSelectedPlant(plantType);
    gameRef.current?.registry.set('selectedPlant', plantType);
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
      backgroundColor: '#2f4a2a',
      // The canvas renders at a fixed 800x400 logical resolution (see the
      // coordinate-system fix above) then gets CSS-scaled up by Scale.FIT to
      // fill the real window — on most screens that's a 2-3x stretch, which
      // looks soft/blurry without a matching bump in backing-store
      // resolution. `resolution` renders at devicePixelRatio internally
      // while keeping game-logic coordinates at 800x400, so it looks sharp
      // without touching any entity/slot coordinate math.
      resolution: window.devicePixelRatio || 1,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      },
      scene: [GameScene],
    });

    gameRef.current = game;
    game.registry.set('roomId', roomId);
    game.registry.set('playerId', playerId);
    game.registry.set('demoMode', demoMode);
    game.registry.set('selectedPlant', selectedPlant);
    setHud((current) => ({ ...current, roomId, playerId, demoMode }));

    if (demoMode) {
      setSocketStatus('Demo mode');
    }

    const offHudUpdate = (() => {
      const handler = (payload: {
        tick: number;
        sun: Record<string, number>;
        wave: number;
        waveStatus: string;
        totalWaves: number;
      }) => {
        setHud((current) => ({
          ...current,
          tick: payload.tick,
          sun: payload.sun || {},
          wave: payload.wave,
          waveStatus: payload.waveStatus,
          totalWaves: payload.totalWaves,
        }));
      };
      game.events.on('hud-update', handler);
      return () => game.events.off('hud-update', handler);
    })();

    // Game Over is a React-owned HTML card (see render below) rather than
    // Phaser canvas text — this listener just records the co-op result.
    const offGameOver = onGameOver((payload) => {
      const result = payload?.result === 'win' ? 'win' : 'lose';
      setGameOverInfo({ result, reason: String(payload?.reason || '') });
    });

    return () => {
      offHudUpdate();
      offGameOver();
      gameRef.current = null;
      game.destroy(true);
    };
  }, [phase, demoMode, playerId, activeRoomId]);

  if (phase === 'menu') {
    return <RoomMenu onJoin={joinRoom} onPlayDemo={playDemo} />;
  }

  if (phase === 'waiting') {
    return <WaitingRoom roomId={activeRoomId} statusText={socketStatus} />;
  }

  const currentPlayerId = hud.playerId || playerId;
  const ownSun = hud.sun[currentPlayerId] ?? 0;
  const sunEntries = Object.entries(hud.sun);

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Plants vs Zombies - Multiplayer</h1>
        <p>
          {demoMode ? 'Demo mode' : `Room ${hud.roomId || activeRoomId}`}
          {' '}• Player {shortId(currentPlayerId)}
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
          <span className="hud-line hud-line--wave">{waveStatusLabel(hud.waveStatus, hud.wave, hud.totalWaves)}</span>
          {sunEntries.length > 0 ? (
            sunEntries.map(([id, value]) => (
              <span className="hud-line" key={id}>
                {id === currentPlayerId ? 'You' : `Teammate (${shortId(id)})`}: {value} sun
              </span>
            ))
          ) : (
            <span className="hud-line">No sun data yet</span>
          )}
        </div>
        <div className="hud-hint">Pick a plant below, then click an open slot to place it.</div>

        <ShopBar ownSun={ownSun} selectedPlant={selectedPlant} onSelectPlant={selectPlant} />

        {gameOverInfo && (
          <div className="menu-backdrop gameover-backdrop">
            <div className="menu-card">
              <h1 className={`menu-title ${gameOverInfo.result === 'win' ? 'gameover-title--win' : 'gameover-title--lose'}`}>
                {gameOverInfo.result === 'win' ? 'You Survived!' : 'The Lawn Was Overrun'}
              </h1>
              <p className="menu-subtitle">
                {gameOverInfo.result === 'win'
                  ? 'You and your teammate cleared every wave'
                  : 'A zombie made it to your side — better luck next time'}
              </p>
              <button className="menu-primary-button" type="button" onClick={backToMenu}>
                Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
