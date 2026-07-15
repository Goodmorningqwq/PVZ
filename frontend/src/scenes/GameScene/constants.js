export const TOWER_COLOR = 0x3f8f4a;
export const ZOMBIE_COLOR = 0x8a6242;
export const PROJECTILE_COLOR = 0x4caf50;
// Softer, warmer palette than the original near-black green — chosen to sit
// visually closer to the white-card/purple-gradient theme used everywhere
// else in the app (menu, waiting room, shop bar) instead of reading as a
// completely separate dark "game mode".
export const LANE_COLOR = 0x7cb06a;
export const LANE_COLOR_ALT = 0x6fa062; // alternating row shade for the 5-lane checkerboard
export const GRASS_COLOR = 0x3a5c34;
export const SLOT_MARKER_COLOR = 0xf2f5ee;

// Fixed logical game resolution. The backend sends entity coordinates in this
// space (see NETWORKING_CONTRACT_REVISED.md "Constants (Shared)"). The Phaser
// game is configured with Scale.FIT at this size so entity coordinates always
// line up with the rendered lane, regardless of the browser window size.
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 400;

export const PLANT_SPRITE_SIZE = 1;
export const ZOMBIE_SPRITE_SIZE = 1;
export const PROJECTILE_RADIUS = 8;

// Per-plant scale multipliers applied on top of PLANT_SPRITE_SIZE. Plants not
// listed here render at 1x.
export const PLANT_SCALE_MULTIPLIERS = {
  peashooter: 2,
};

export const HP_LABEL_OFFSET = {
  plant: { x: 0, y: -42 },
  zombie: { x: 0, y: -40 },
};

// --- Board layout (must match backend/src/index.ts) ------------------------
// 5 lanes (rows), 8 slots per lane (columns) — classic PvZ-style grid.
export const LANE_COUNT = 5;
export const LANE_MARGIN = 40;
export const LANE_SPACING = (GAME_HEIGHT - LANE_MARGIN * 2) / (LANE_COUNT - 1);
export const SLOT_COUNT = 8; // per lane
export const SLOT_MARGIN = 48;
export const SLOT_SPACING = (GAME_WIDTH - SLOT_MARGIN * 2) / SLOT_COUNT;
export const SLOT_RADIUS = 30; // click-hit radius around a slot center

export function getLaneY(laneIndex) {
  return Math.round(LANE_MARGIN + LANE_SPACING * laneIndex);
}

export function getSlotPositions() {
  const positions = [];
  for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
    for (let col = 0; col < SLOT_COUNT; col += 1) {
      positions.push({
        index: laneIndex * SLOT_COUNT + col,
        laneIndex,
        x: Math.round(SLOT_MARGIN + SLOT_SPACING * (col + 0.5)),
        y: getLaneY(laneIndex),
      });
    }
  }
  return positions;
}

// --- Plants (numbers mirror backend/src/index.ts PLANT_DEFS; shown in the
// shop bar so players know cost before placing). ---------------------------
export const PLANT_STATS = {
  peashooter: { cost: 100, label: 'Peashooter' },
  sunflower: { cost: 50, label: 'Sunflower' },
};