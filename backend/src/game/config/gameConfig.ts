export const BOARD_WIDTH = 800;
export const BOARD_HEIGHT = 400;
export const LANE_COUNT = 5;
export const LANE_MARGIN = 40;
export const SLOT_COUNT = 8;
export const SLOT_MARGIN = 48;
export const ZOMBIE_SPAWN_X = BOARD_WIDTH - 20;
export const LAWN_BREACH_X = 0;

export const TICK_RATE = Number(process.env.TICK_RATE || 20);
export const STARTING_SUN = 150;
export const PRE_GAME_DELAY_TICKS = 6 * TICK_RATE;
export const WAVE_BREAK_TICKS = 8 * TICK_RATE;

export const ZOMBIE_HP = 20;
export const ZOMBIE_SPEED = 1;
export const ZOMBIE_RADIUS = 16;
export const ZOMBIE_CHOMP_DAMAGE = 20;
export const ZOMBIE_CHOMP_INTERVAL_TICKS = TICK_RATE;

export const WAVES = [
  { count: 3, spawnIntervalTicks: 6 * TICK_RATE },
  { count: 5, spawnIntervalTicks: 5 * TICK_RATE },
  { count: 7, spawnIntervalTicks: 4 * TICK_RATE },
];

export const PLANT_DEFS = {
  peashooter: {
    cost: 100,
    hp: 100,
    damage: 20,
    cooldownTicks: Math.round(1.4 * TICK_RATE),
  },
  sunflower: {
    cost: 50,
    hp: 100,
    sunAmount: 25,
    intervalTicks: Math.round(24 * TICK_RATE),
  },
} as const;
