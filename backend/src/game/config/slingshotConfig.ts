import { BOARD_HEIGHT, LANE_COUNT, LANE_MARGIN } from './gameConfig.js';

// Row 3 (0-indexed lane 2) — same lane-Y formula duplicated in
// defaultGameEngine.ts (roomLaneY) and roomStore.ts (getLaneY); config files
// stay dependency-free of the engine, so it's replicated here rather than
// imported.
export const SLINGSHOT_LANE_INDEX = 2;
const laneSpacing = (BOARD_HEIGHT - LANE_MARGIN * 2) / (LANE_COUNT - 1);
export const SLINGSHOT_X = 28;
export const SLINGSHOT_Y = Math.round(LANE_MARGIN + laneSpacing * SLINGSHOT_LANE_INDEX);

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

// Flight duration and arc height both scale with travel distance, so longer
// shots take a bit longer and arc a bit higher rather than teleporting flat.
export const SLINGSHOT_BASE_FLIGHT_TICKS = 14;
export const SLINGSHOT_FLIGHT_TICKS_PER_100PX = 6;
export const SLINGSHOT_ZMAX_BASE = 40;
export const SLINGSHOT_ZMAX_PER_100PX = 20;
