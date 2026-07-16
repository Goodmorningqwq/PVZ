import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { onGameOver } from '../../network';
import ShopBar from './ShopBar/ShopBar';
import GameScene from './GameScene/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './GameScene/constants';

type GameProps = {
  roomId: string;
  playerId: string;
  demoMode: boolean;
  onePlayerMode: boolean;
  socketStatus: string;
  connected: boolean;
};

type PlantDef = {
  cost: number;
  label: string;
};

type HudState = {
  tick: number;
  sun: Record<string, number>;
  plantDefs: Record<string, PlantDef>;
  wave: number;
  waveStatus: string;
  totalWaves: number;
};

type GameOverInfo = {
  result: 'win' | 'lose';
  reason: string;
};

const initialHud: HudState = {
  tick: 0,
  sun: {},
  plantDefs: {},
  wave: 0,
  waveStatus: 'pending',
  totalWaves: 0,
};

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

function backToMenu() {
  window.location.href = window.location.pathname;
}

export default function Game({ roomId, playerId, demoMode, onePlayerMode, socketStatus, connected }: GameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [linkCopied, setLinkCopied] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);

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

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

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
      // Plant sprite frames are pixel art scaled up via PLANT_SPRITE_SIZE.
      // `pixelArt: true` switches every texture to nearest-neighbor/point
      // sampling instead of the default bilinear filtering, and rounds
      // sprite positions to whole pixels, so the upscale stays crisp instead
      // of going soft.
      pixelArt: true,
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
    game.registry.set('selectedPlant', selectedPlant);

    const offHudUpdate = (() => {
      const handler = (payload: {
        tick: number;
        sun: Record<string, number>;
        plantDefs: Record<string, PlantDef>;
        wave: number;
        waveStatus: string;
        totalWaves: number;
      }) => {
        setHud((current) => ({
          ...current,
          tick: payload.tick,
          sun: payload.sun || {},
          plantDefs: payload.plantDefs || {},
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
  }, [roomId, playerId]);

  const ownSun = hud.sun[playerId] ?? 0;
  const sunEntries = Object.entries(hud.sun);
  const shareable = !demoMode && !onePlayerMode;

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Plants vs Zombies - Multiplayer</h1>
        <p>
          {demoMode ? 'Demo mode' : onePlayerMode ? 'Solo mode' : `Room ${roomId}`}
          {' '}• Player {shortId(playerId)}
          {shareable && (
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
          <span className={`mode-badge ${demoMode ? 'mode-badge--demo' : onePlayerMode ? 'mode-badge--solo' : 'mode-badge--live'}`}>
            {demoMode ? 'DEMO' : onePlayerMode ? 'SOLO' : 'LIVE'}
          </span>
          <span className="hud-line hud-line--wave">{waveStatusLabel(hud.waveStatus, hud.wave, hud.totalWaves)}</span>
          {sunEntries.length > 0 ? (
            sunEntries.map(([id, value]) => (
              <span className="hud-line" key={id}>
                {id === playerId ? 'You' : `Teammate (${shortId(id)})`}: {value} sun
              </span>
            ))
          ) : (
            <span className="hud-line">No sun data yet</span>
          )}
        </div>
        <div className="hud-hint">Pick a plant below, then click an open slot to place it.</div>

        <ShopBar ownSun={ownSun} selectedPlant={selectedPlant} onSelectPlant={selectPlant} plantDefs={hud.plantDefs} />

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
