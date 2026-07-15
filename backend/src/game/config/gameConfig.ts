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

// Sun pickups: a sunflower proc no longer credits purses directly — it drops a
// collectible sun on the board that a player collects by hovering their
// cursor over it (see NETWORKING_CONTRACT_REVISED.md). Collecting still
// credits both purses (shared economy, unchanged). An uncollected sun
// despawns after SUN_PICKUP_LIFETIME_TICKS with no income awarded, mirroring
// classic PvZ's ~10s sun timeout (tuned to 20s here since collection is
// hover-based, not click-based, and easier to miss).
export const SUN_PICKUP_RADIUS = 26; // hover-hit radius, client + server validation
export const SUN_PICKUP_LIFETIME_TICKS = 20 * TICK_RATE;
// The pickup's resting spot is offset from the sunflower's own slot position
// (not dead-center on it) so it visually reads as a separate collectible
// floating near the plant instead of sitting on top of/replacing the
// sunflower's art. Offset upward (toward the top of the lane) with a little
// horizontal jitter for variety, similar to how classic PvZ suns land beside
// rather than directly on the sunflower.
export const SUN_PICKUP_OFFSET_Y = -34;
export const SUN_PICKUP_OFFSET_X_JITTER = 16; // +/- this, randomized per spawn

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
