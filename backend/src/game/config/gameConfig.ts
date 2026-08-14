export const BOARD_WIDTH = 800;
export const BOARD_HEIGHT = 400;
export const LANE_COUNT = 5;
export const LANE_MARGIN = 40;
export const SLOT_COUNT = 8;
export const SLOT_MARGIN = 48;
export const ZOMBIE_SPAWN_X = BOARD_WIDTH - 20;
export const LAWN_BREACH_X = 0;

// --- Board geometry: THE source of truth for where anything sits ------------
//
// Every board coordinate in the game derives from these two functions. They
// live in the config (not the engine) so that config modules like
// slingshotConfig.ts can use them without importing the engine, which is what
// previously forced the lane-Y formula to be copy-pasted around.
//
// Before this existed the same two formulas were written out in four separate
// places — roomStore.buildSlots, defaultGameEngine.roomLaneY (which hardcoded
// 400 and 40 as literals rather than importing them, so it silently ignored
// any change to the board size), slingshotConfig, and again on the client.
// Nothing failed when they drifted; the only symptom was visual.
//
// If the playfield ever needs to stop being "the whole canvas" — e.g. inset to
// the lawn area of a background image that has a house down one side — this is
// the only place that has to change on the server.

export function getLaneY(laneIndex: number): number {
  const laneSpacing = (BOARD_HEIGHT - LANE_MARGIN * 2) / (LANE_COUNT - 1);
  return Math.round(LANE_MARGIN + laneSpacing * laneIndex);
}

export function getSlotX(col: number): number {
  const slotSpacing = (BOARD_WIDTH - SLOT_MARGIN * 2) / SLOT_COUNT;
  return Math.round(SLOT_MARGIN + slotSpacing * (col + 0.5));
}

export const TICK_RATE = Number(process.env.TICK_RATE || 20);
export const STARTING_SUN = 150;

// Defaults for a rank-and-file zombie. Every ZOMBIE_DEFS entry restates these
// explicitly rather than inheriting them, so a def is a complete description of
// its zombie and adding a type can't silently pick up a value nobody chose for
// it. Kept exported because the client mirrors the base radius for hit-tests.
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

// Every zombie type, and the complete set of stats that describe one. `radius`,
// `chompDamage` and `chompIntervalTicks` used to be global constants applied to
// all zombies alike; they're per-type now so a heavier zombie can genuinely be
// bigger and hit harder rather than just having more HP.
//
// `boss: true` marks a type as a set-piece rather than rank-and-file. It drives
// presentation only — an HP bar instead of a bare number, a bigger sprite — and
// carries no mechanical weight of its own, so a future boss just sets the flag
// and picks its own stats.
export const ZOMBIE_DEFS = {
  shambler: {
    hp: 20,
    speed: 1,
    label: 'Shambler',
    radius: ZOMBIE_RADIUS,
    chompDamage: ZOMBIE_CHOMP_DAMAGE,
    chompIntervalTicks: ZOMBIE_CHOMP_INTERVAL_TICKS,
    boss: false,
  },
  runner: {
    hp: 12,
    speed: 2,
    label: 'Runner',
    radius: ZOMBIE_RADIUS,
    chompDamage: ZOMBIE_CHOMP_DAMAGE,
    chompIntervalTicks: ZOMBIE_CHOMP_INTERVAL_TICKS,
    boss: false,
  },
  // First boss-tier zombie. Named for what it is rather than the role it
  // plays: ZOMBIE_DEFS keys are species, so calling this one `boss` would
  // leave a second boss with nowhere to go.
  //
  // Tuned as a wall that has to be focused down rather than a fast threat.
  // 400 HP is 20 shamblers' worth — roughly 20 peashooter hits, or 7 well
  // centred slingshot shots. Slow enough (0.3 vs the shambler's 1) that a
  // prepared lane has time to work, but its chomp kills a peashooter in two
  // bites instead of five, so an unprepared lane collapses fast.
  brute: {
    hp: 400,
    speed: 0.3,
    label: 'Brute',
    radius: 30,
    chompDamage: 60,
    chompIntervalTicks: Math.round(TICK_RATE * 1.4),
    boss: true,
  },
} as const;

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

// Plant matter overflow. The pool used to be uncapped, so the optimal play was
// simply to hoard: collect everything, spend nothing, never be short. This
// gives hoarding a cost.
//
// Going over PLANT_MATTER_SOFT_MAX doesn't bite immediately — you get
// PLANT_MATTER_OVERFLOW_GRACE_TICKS to spend back down first, so a big drop
// from a cleared wave isn't an instant punishment for playing well. Sit over
// the cap past the grace and every plant slows by
// PLANT_MATTER_OVERFLOW_RATE_MULTIPLIER until you spend back under.
//
// The cap is soft: matter still accumulates past it. The penalty is the
// pressure, not a hard ceiling, so you never silently lose a pickup you
// collected.
//
// 2x is deliberately gentler than the 4x tired penalty — overflow hits every
// plant on the board at once, where tired hits one.
export const PLANT_MATTER_SOFT_MAX = 400;
export const PLANT_MATTER_OVERFLOW_GRACE_TICKS = 10 * TICK_RATE;
export const PLANT_MATTER_OVERFLOW_RATE_MULTIPLIER = 2;

// Pure numeric predicate rather than one taking RoomState: plant behaviors and
// the engine both need it, and routing it through either of those modules
// would make them import each other.
export function isPlantMatterOverflowing(plantMatter: number, graceTicksRemaining: number): boolean {
  return plantMatter > PLANT_MATTER_SOFT_MAX && graceTicksRemaining <= 0;
}

// Shovel / plant removal. Removing a plant refunds a fraction of its original
// sun cost, floored to a whole number. The refund goes back to the plant's
// *owner* (the player who paid for it), not to whoever swung the shovel —
// placement deducts from the placer's purse alone, so this is the clean
// inverse of that. Either player may remove any plant, matching the fully
// shared placement rights described in NETWORKING_CONTRACT_REVISED.md.
export const PLANT_REMOVAL_REFUND_FRACTION = 0.5;

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
