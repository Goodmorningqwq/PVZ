import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { emitUseMatterOnPlant, getLatestState, onActionRejected, onGameOver } from '../../network';
import ShopBar from './ShopBar/ShopBar';
import PlantMatterBar from './PlantMatterBar/PlantMatterBar';
import SunMeter from './SunMeter/SunMeter';
import Shovel from './Shovel/Shovel';
import GameScene from './GameScene/GameScene';
import { GAME_WIDTH, GAME_HEIGHT, SERVER_TICK_RATE, SLOT_RADIUS } from './GameScene/constants';
import { backToMenu, copyInviteLink, shortId } from '../shared/session';

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

type PlantMatterOverflow = {
  over: boolean;
  graceTicksRemaining: number;
  active: boolean;
};

// Deliberately no `tick`. It used to be stored here and set from every
// hud-update, which forced a React re-render 20 times a second for a value
// nothing ever rendered. GameScene already tracks the tick itself
// (lastRenderedTick) to decide when to redraw.
type HudState = {
  sun: Record<string, number>;
  plantUnlocks: Record<string, string[]>;
  plantMatter: number;
  plantMatterMax: number;
  plantMatterOverflow: PlantMatterOverflow;
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
  sun: {},
  plantUnlocks: {},
  plantMatter: 0,
  plantMatterMax: 0,
  plantMatterOverflow: { over: false, graceTicksRemaining: 0, active: false },
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
  no_plant_in_slot: 'Nothing to dig up there.',
  invalid_slot: "That's not a slot.",
  on_cooldown: "Slingshot's still reloading.",
  plant_locked: "You haven't unlocked that plant yet.",
  insufficient_sun: 'Not enough sun for that.',
};

// Actions that surface a toast when the server rejects them. Everything else
// still fails silently, per the convention documented in
// NETWORKING_CONTRACT_REVISED.md. fire_slingshot's other rejection
// (pull_too_small) never reaches the server at all - GameScene only emits
// once the drag clears the arm threshold client-side.
const TOASTED_ACTIONS = new Set(['use_plant_matter', 'remove_plant', 'fire_slingshot', 'place_plant']);

function waveStatusLabel(waveStatus: string, wave: number, totalWaves: number) {
  if (waveStatus === 'pending') return 'Get ready...';
  if (waveStatus === 'break') return `Wave ${wave} cleared — next wave incoming...`;
  if (waveStatus === 'complete') return 'All waves cleared!';
  if (totalWaves > 0) return `Wave ${wave} / ${totalWaves}`;
  return `Wave ${wave}`;
}

export default function Game({ roomId, playerId, demoMode, onePlayerMode, socketStatus, connected }: GameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [linkCopied, setLinkCopied] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [shovelActive, setShovelActive] = useState(false);
  // True while the plant matter handle is being dragged. Used only to fade the
  // overflow alert out of the way — it sits over the middle of the board, and
  // the thing it asks you to do is aim at a plant underneath it.
  const [matterDragging, setMatterDragging] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const actionToastTimeoutRef = useRef<number | null>(null);

  // Plant selection and the shovel are mutually exclusive placement modes:
  // arming one disarms the other, so GameScene's pointerdown handler never has
  // to decide between placing and digging.
  function selectPlant(plantType: string) {
    setSelectedPlant(plantType);
    setShovelActive(false);
    gameRef.current?.registry.set('selectedPlant', plantType);
    gameRef.current?.registry.set('shovelActive', false);
  }

  function toggleShovel() {
    setShovelActive((current) => {
      const next = !current;
      gameRef.current?.registry.set('shovelActive', next);
      if (next) {
        setSelectedPlant(null);
        gameRef.current?.registry.set('selectedPlant', null);
      }
      return next;
    });
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

  async function handleCopyInviteLink() {
    const ok = await copyInviteLink();
    setLinkCopied(ok);
    if (ok) {
      window.setTimeout(() => setLinkCopied(false), 2000);
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
      // NOTE: there used to be a `resolution: window.devicePixelRatio` here,
      // meant to render at device pixel density while keeping game-logic
      // coordinates at 800x400. It never did anything — `resolution` was
      // removed from Phaser's GameConfig in 3.16 and this project is on 3.90,
      // so it was silently ignored at runtime and a hard type error under
      // `tsc --noEmit`. The canvas genuinely renders at 800x400 and is
      // CSS-upscaled by Scale.FIT, which is why everything looks soft. Fixing
      // that properly means raising the logical resolution on both client and
      // server, not re-adding this key.
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
    game.registry.set('shovelActive', false);

    // GameScene disarms the shovel after a swing (one plant per arm, like
    // classic PvZ) — mirror that back into React state so the button's active
    // styling clears too.
    const offShovelUsed = (() => {
      const handler = () => {
        setShovelActive(false);
        game.registry.set('shovelActive', false);
      };
      game.events.on('shovel-used', handler);
      return () => game.events.off('shovel-used', handler);
    })();

    const offHudUpdate = (() => {
      const handler = (payload: {
        sun: Record<string, number>;
        plantUnlocks: Record<string, string[]>;
        plantMatter: number;
        plantMatterMax: number;
        plantMatterOverflow: PlantMatterOverflow;
        plantDefs: Record<string, PlantDef>;
        wave: number;
        waveStatus: string;
        totalWaves: number;
      }) => {
        setHud((current) => ({
          ...current,
          sun: payload.sun || {},
          plantUnlocks: payload.plantUnlocks || {},
          plantMatterMax: Number.isFinite(payload.plantMatterMax) ? payload.plantMatterMax : 0,
          plantMatterOverflow: payload.plantMatterOverflow || { over: false, graceTicksRemaining: 0, active: false },
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

    // Scoped to the actions in TOASTED_ACTIONS — place_plant/collect_sun
    // rejections are still silent, matching the rest of this codebase's
    // established "no feedback on a rejected action" convention. Dragging
    // plant matter onto a plant, and swinging the shovel, are the two actions
    // where the reason for nothing happening isn't otherwise discoverable.
    const offActionRejected = onActionRejected((payload) => {
      if (!TOASTED_ACTIONS.has(payload?.action)) {
        return;
      }
      const message = ACTION_REJECTED_MESSAGES[payload?.reason] || "That didn't work.";
      showActionToast(message);
    });

    return () => {
      offHudUpdate();
      offGameOver();
      offActionRejected();
      offShovelUsed();
      if (actionToastTimeoutRef.current) {
        window.clearTimeout(actionToastTimeoutRef.current);
      }
      gameRef.current = null;
      game.destroy(true);
    };
  }, [roomId, playerId]);

  const ownSun = hud.sun[playerId] ?? 0;
  // Same lookup pattern as ownSun: the server sends every player's set and each
  // client reads its own. `null` means the server didn't say, which the shop
  // treats as no restriction — the real gate is server-side in placePlant, so a
  // missing entry must never lock a player out of their own game.
  const ownUnlocks = hud.plantUnlocks[playerId] ?? null;
  const shareable = !demoMode && !onePlayerMode;

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Plants vs Zombies - Multiplayer</h1>
        <p>
          {demoMode ? 'Demo mode' : onePlayerMode ? 'Solo mode' : `Room ${roomId}`}
          {' '}• Player {shortId(playerId)}
          {shareable && (
            <button className="copy-link-button" type="button" onClick={handleCopyInviteLink}>
              {linkCopied ? 'Copied!' : 'Copy invite link'}
            </button>
          )}
        </p>
        <p>Status: {socketStatus} {connected ? '• connected' : '• disconnected'}</p>
      </div>
      <div className="game-stage">
        <div className="stage-suns">
          <SunMeter playerId={playerId} sun={hud.sun} />
        </div>

        <div className="stage-seedbar">
          <ShopBar
            ownSun={ownSun}
            selectedPlant={selectedPlant}
            onSelectPlant={selectPlant}
            plantDefs={hud.plantDefs}
            unlockedPlants={ownUnlocks}
          />
          <div className="stage-wave">
            <span className={`mode-badge ${demoMode ? 'mode-badge--demo' : onePlayerMode ? 'mode-badge--solo' : 'mode-badge--live'}`}>
              {demoMode ? 'DEMO' : onePlayerMode ? 'SOLO' : 'LIVE'}
            </span>
            <span className="stage-wave-label">{waveStatusLabel(hud.waveStatus, hud.wave, hud.totalWaves)}</span>
          </div>
        </div>

        <div className="stage-tools">
          <Shovel active={shovelActive} onToggle={toggleShovel} />
          <div className="stage-tools-spacer" />
          <PlantMatterBar
            plantMatter={hud.plantMatter}
            plantMatterMax={hud.plantMatterMax}
            overflow={hud.plantMatterOverflow}
            onDrop={handleMatterDrop}
            onDragStateChange={setMatterDragging}
          />
        </div>

        <div className="game-canvas-wrapper">
          <div ref={containerRef} className="game-canvas" />
          <div className="hud-hint">
            {shovelActive
              ? 'Shovel armed — click a plant to dig it up for a partial refund.'
              : 'Pick a plant above, then click an open slot to place it. Drag the bird on the slingshot and release to fire.'}
          </div>

          {/* Overflow alert, centred over the play area rather than tucked
              under the plant matter bar. Two escalating states: a countdown
              you can still act on, then the penalty actually biting. Both are
              pointer-events: none so they never swallow a board click — the
              player has to be able to keep planting while it's up. The screen
              shake that accompanies the second state is a Phaser camera
              effect driven from GameScene, not CSS. */}
          {hud.plantMatterOverflow.over && !hud.plantMatterOverflow.active && (
            <div className={`overflow-alert ${matterDragging ? 'overflow-alert--ducked' : ''}`} role="status">
              <span className="overflow-alert-title">Over capacity</span>
              <span className="overflow-alert-sub">
                Spend within {Math.ceil(hud.plantMatterOverflow.graceTicksRemaining / SERVER_TICK_RATE)}s
              </span>
            </div>
          )}

          {hud.plantMatterOverflow.active && (
            <div
              className={`overflow-alert overflow-alert--active ${matterDragging ? 'overflow-alert--ducked' : ''}`}
              role="alert"
            >
              <span className="overflow-alert-title">Use your plant matter</span>
              <span className="overflow-alert-sub">Drag matter onto a plant</span>
            </div>
          )}

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
