import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { emitUseMatterOnPlant, getLatestState, onActionRejected, onGameOver } from '../../network';
import ShopBar from './ShopBar/ShopBar';
import PlantMatterBar from './PlantMatterBar/PlantMatterBar';
import SunMeter from './SunMeter/SunMeter';
import GameScene from './GameScene/GameScene';
import { GAME_WIDTH, GAME_HEIGHT, SLOT_RADIUS } from './GameScene/constants';

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
  plantMatter: number;
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
  plantMatter: 0,
  plantDefs: {},
  wave: 0,
  waveStatus: 'pending',
  totalWaves: 0,
};

// Rejection reasons the server can send back over action_rejected, mapped to
// player-facing copy. Anything not in this map falls back to a generic
// message rather than surfacing a raw internal reason string.
const ACTION_REJECTED_MESSAGES: Record<string, string> = {
  insufficient_plant_matter: 'Not enough plant matter for that yet.',
};

// Session IDs are long UUIDs meant for the wire, not for a human to read.
// Shorten them for display until real display names exist.
function shortId(id: string) {
  return id ? id.slice(0, 8) : '';
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
  const [actionToast, setActionToast] = useState<string | null>(null);
  const actionToastTimeoutRef = useRef<number | null>(null);

  function selectPlant(plantType: string) {
    setSelectedPlant(plantType);
    gameRef.current?.registry.set('selectedPlant', plantType);
  }

  function showActionToast(message: string) {
    if (actionToastTimeoutRef.current) {
      window.clearTimeout(actionToastTimeoutRef.current);
    }
    setActionToast(message);
    actionToastTimeoutRef.current = window.setTimeout(() => setActionToast(null), 2500);
  }

  // Drag-to-repair/buff: the handle only tells us where on the page the
  // pointer was released (pageX/pageY, not clientX/clientY - see the
  // onDrop prop comment in PlantMatterBar.tsx). game.scale.transformX/Y
  // convert that into the same world-space coordinates entities are
  // rendered in (accounting for Scale.FIT's CSS scaling of the canvas),
  // then we find the nearest occupied slot within SLOT_RADIUS and target
  // it. No plant nearby -> silent no-op, per design (dragging onto empty
  // grass just does nothing, no error needed since nothing was really
  // "attempted").
  function handleMatterDrop(pageX: number, pageY: number) {
    const game = gameRef.current;
    if (!game) {
      return;
    }

    // transformX/Y live on the ScaleManager (game.scale), not the
    // InputManager - confirmed against the installed Phaser 3.90 type defs.
    // (Earlier attempts at game.input.manager.transformX and
    // game.input.transformX were both wrong - transformX isn't part of the
    // InputManager's public API at all in this Phaser version.)
    const worldX = game.scale.transformX(pageX);
    const worldY = game.scale.transformY(pageY);

    const slots = getLatestState()?.slots ?? [];
    let nearestSlot: { index: number; x: number; y: number } | null = null;
    let nearestDistance = SLOT_RADIUS;

    for (const slot of slots) {
      if (!slot.plant) {
        continue;
      }
      const dx = slot.x - worldX;
      const dy = slot.y - worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestSlot = slot;
      }
    }

    if (!nearestSlot) {
      return;
    }

    emitUseMatterOnPlant({ roomId, playerId, slotIndex: nearestSlot.index });
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
        plantMatter: number;
        plantDefs: Record<string, PlantDef>;
        wave: number;
        waveStatus: string;
        totalWaves: number;
      }) => {
        setHud((current) => ({
          ...current,
          tick: payload.tick,
          sun: payload.sun || {},
          plantMatter: Number.isFinite(payload.plantMatter) ? payload.plantMatter : 0,
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

    // Scoped to use_plant_matter only for now — place_plant/collect_sun
    // rejections are still silent, matching the rest of this codebase's
    // established "no feedback on a rejected action" convention. Dragging
    // plant matter onto a plant is the one action where the reason for
    // nothing happening isn't otherwise discoverable.
    const offActionRejected = onActionRejected((payload) => {
      if (payload?.action !== 'use_plant_matter') {
        return;
      }
      const message = ACTION_REJECTED_MESSAGES[payload?.reason] || "That didn't work.";
      showActionToast(message);
    });

    return () => {
      offHudUpdate();
      offGameOver();
      offActionRejected();
      if (actionToastTimeoutRef.current) {
        window.clearTimeout(actionToastTimeoutRef.current);
      }
      gameRef.current = null;
      game.destroy(true);
    };
  }, [roomId, playerId]);

  const ownSun = hud.sun[playerId] ?? 0;
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
        <div className="game-sidebar">
          <SunMeter
            demoMode={demoMode}
            onePlayerMode={onePlayerMode}
            playerId={playerId}
            sun={hud.sun}
            wave={hud.wave}
            waveStatus={hud.waveStatus}
            totalWaves={hud.totalWaves}
          />
          <ShopBar ownSun={ownSun} selectedPlant={selectedPlant} onSelectPlant={selectPlant} plantDefs={hud.plantDefs} />
          <PlantMatterBar plantMatter={hud.plantMatter} onDrop={handleMatterDrop} />
        </div>
        <div className="game-canvas-wrapper">
          <div ref={containerRef} className="game-canvas" />
          <div className="hud-hint">Pick a plant on the left, then click an open slot to place it.</div>

          {actionToast && <div className="action-toast">{actionToast}</div>}

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
    </div>
  );
}
