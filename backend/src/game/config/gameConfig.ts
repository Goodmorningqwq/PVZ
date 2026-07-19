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

// Plant stamina: every peashooter shot / sunflower proc drains a bit of
// stamina. At 0 the plant is "tired" and its rate (fire cooldown / sun
// interval) is multiplied by TIRED_RATE_MULTIPLIER (i.e. dramatically
// slower), until it's repaired with plant matter. Wall-nut has no active
// behavior (see plantBehaviors.ts advanceWallnut) so it never drains and
// this system doesn't apply to it in practice, even though it still carries
// a staminaMax for type uniformity.
export const STAMINA_MAX = 100;
export const PEASHOOTER_STAMINA_DRAIN_PER_SHOT = 4; // ~25 shots (~35s of firing) before tired
export const SUNFLOWER_STAMINA_DRAIN_PER_PROC = 20; // 5 procs (~2min) before tired
export const TIRED_RATE_MULTIPLIER = 4; // cooldown/interval x4 while tired == dramatically slower

// Plant matter: dropped by every zombie killed (not ones that breach the
// lawn — the game just ends then). Amount is randomized per kill. Collected
// the same way sun is (hover/tap), but funds a single pool shared identically
// by both players (not per-player purses like sun), spent via useMatterOnPlant.
export const PLANT_MATTER_DROP_MIN = 10;
export const PLANT_MATTER_DROP_MAX = 100;
export const PLANT_MATTER_PICKUP_RADIUS = 26; // matches SUN_PICKUP_RADIUS
export const PLANT_MATTER_PICKUP_LIFETIME_TICKS = 20 * TICK_RATE;

// Repair (tired plant -> full stamina) vs. buff (already-healthy plant ->
// temporary 1.5x rate boost, symmetric with the tired penalty). Buff costs
// double repair, per design. Which one applies is decided server-side by
// whether the targeted plant is currently tired — the client never chooses.
export const PLANT_MATTER_REPAIR_COST = 40;
export const PLANT_MATTER_BUFF_COST_MULTIPLIER = 2;
export const PLANT_MATTER_BUFF_RATE_MULTIPLIER = 1.5;
export const PLANT_MATTER_BUFF_DURATION_TICKS = 20 * TICK_RATE;

export const PLANT_DEFS = {
  peashooter: {
    cost: 100,
    hp: 100,
    damage: 20,
    cooldownTicks: Math.round(1.4 * TICK_RATE),
    staminaMax: STAMINA_MAX,
    label: 'Peashooter',
  },
  sunflower: {
    cost: 50,
    hp: 100,
    sunAmount: 25,
    intervalTicks: Math.round(24 * TICK_RATE),
    staminaMax: STAMINA_MAX,
    label: 'Sunflower',
  },
  wallnut: {
    cost: 50,
    hp: 1000,
    staminaMax: STAMINA_MAX,
    label: 'Wall-nut',
  },
} as const;
