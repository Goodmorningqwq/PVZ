import { LAWN_LEFT, getLaneY } from './gameConfig.js';

// Row 3 (0-indexed lane 2). This used to re-implement the lane-Y formula
// locally, with a comment explaining that config files stay dependency-free of
// the engine so replication was unavoidable. That reasoning was sound but the
// conclusion wasn't — the formula belongs in the config alongside the
// constants it reads, not in the engine, so it can just be imported.
export const SLINGSHOT_LANE_INDEX = 2;

// Sits just off the left edge of the grass, on the walkway — the defender's
// side of the lawn, firing onto it.
//
// This used to be a hardcoded 28, from when the playfield was the whole
// canvas. Now that the grid is inset to the lawn, x=28 is the brick roof of
// the house, which would have left the fork buried in the scenery. Deriving it
// from LAWN_LEFT keeps it planted at the lawn's edge if that boundary is ever
// retuned.
export const SLINGSHOT_X = Math.max(20, LAWN_LEFT - 30);
export const SLINGSHOT_Y = getLaneY(SLINGSHOT_LANE_INDEX);

// Drag-to-aim. The pull vector is clamped to this radius (board px), and only
// arms a shot once its leftward (away-from-the-fork) component clears
// SLINGSHOT_MIN_PULL_X — see fireSlingshot in defaultGameEngine.ts for why
// that's what guarantees the mirrored launch always points into the board.
export const SLINGSHOT_MAX_PULL = 140;
export const SLINGSHOT_MIN_PULL_X = 18;
// rawTarget = anchor - pull * RANGE_MULTIPLIER. Tuned so MAX_PULL reaches the
// far column/row from the anchor with room to spare. The anchor sits close to
// the board's left edge, so a real drag past it is unavoidable - the client
// captures the pointer for the drag's duration (see tryStartSlingshotDrag in
// GameScene.js) so the browser keeps reporting real cursor position instead
// of freezing at the canvas boundary.
export const SLINGSHOT_RANGE_MULTIPLIER = 6;

export const SLINGSHOT_COOLDOWN_TICKS = 60; // ~3s at the default 20 TICK_RATE

export const SLINGSHOT_DAMAGE = 60;
export const SLINGSHOT_SPLASH_RADIUS = 50;

// Splash falloff. A direct hit deals the full SLINGSHOT_DAMAGE; a zombie
// clipped at the very edge of the blast deals this fraction of it, with a
// linear ramp between. Previously every zombie inside the radius took the full
// 60 regardless of distance, which made aim precision worth nothing — a lazy
// shot landing near a cluster was exactly as good as a centred one.
export const SLINGSHOT_SPLASH_MIN_DAMAGE_FRACTION = 0.35;

// Flight duration and arc height both scale with travel distance, so longer
// shots take a bit longer and arc a bit higher rather than teleporting flat.
export const SLINGSHOT_BASE_FLIGHT_TICKS = 14;
export const SLINGSHOT_FLIGHT_TICKS_PER_100PX = 6;
export const SLINGSHOT_ZMAX_BASE = 40;
export const SLINGSHOT_ZMAX_PER_100PX = 20;
