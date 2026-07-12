export const TOWER_COLOR = 0x3f8f4a;
export const ZOMBIE_COLOR = 0x7d5a3c;
export const LANE_COLOR = 0x587248;
export const GRASS_COLOR = 0x1e2f1c;

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