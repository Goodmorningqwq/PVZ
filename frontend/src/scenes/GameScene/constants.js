export const TOWER_COLOR = 0x3f8f4a;
export const ZOMBIE_COLOR = 0x8a6242;
// Softer, warmer palette than the original near-black green — chosen to sit
// visually closer to the white-card/purple-gradient theme used everywhere
// else in the app (menu, waiting room, shop bar) instead of reading as a
// completely separate dark "game mode".
export const LANE_COLOR = 0x7cb06a;
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

export const HP_LABEL_OFFSET = {
  plant: { x: 0, y: -42 },
  zombie: { x: 0, y: -40 },
};

export const PLANT_ASSET_KEYS = ['peashooter', 'sunflower', 'wallnut'];

// --- Board layout (must match backend/src/index.ts) ------------------------
export const LANE_Y = 200;
export const SLOT_COUNT = 8;
export const SLOT_MARGIN = 48;
export const SLOT_SPACING = (GAME_WIDTH - SLOT_MARGIN * 2) / SLOT_COUNT;
export const SLOT_RADIUS = 34; // click-hit radius around a slot center

export function getSlotPositions() {
  const positions = [];
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    positions.push({
      index: i,
      x: Math.round(SLOT_MARGIN + SLOT_SPACING * (i + 0.5)),
      y: LANE_Y,
    });
  }
  return positions;
}

// --- Plants (numbers mirror backend/src/index.ts PLANT_DEFS; shown in the
// shop bar so players know cost before placing). ---------------------------
export const PLANT_STATS = {
  peashooter: { cost: 100, label: 'Peashooter' },
  sunflower: { cost: 50, label: 'Sunflower' },
};