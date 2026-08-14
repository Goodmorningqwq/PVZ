export const TOWER_COLOR = 0x3f8f4a;
export const ZOMBIE_COLOR = 0x8a6242;
// Boss-tier zombies (ZOMBIE_DEFS entries with boss: true) get a darker, redder
// body so they read as a different threat class at a glance rather than just
// "a bigger brown rectangle".
export const BOSS_ZOMBIE_COLOR = 0x7a3b2c;
// Fallback body radius for a zombie whose state_update predates the per-type
// `radius` field. Matches ZOMBIE_RADIUS in the backend's gameConfig.ts.
export const ZOMBIE_DEFAULT_RADIUS = 16;
// The old hardcoded body was 40x68 at radius 16, so deriving size from radius
// with these ratios leaves ordinary zombies pixel-identical while letting a
// brute actually look like one.
export const ZOMBIE_BODY_WIDTH_PER_RADIUS = 2.5;
export const ZOMBIE_BODY_HEIGHT_PER_RADIUS = 4.25;
export const PROJECTILE_COLOR = 0x4caf50;
// Softer, warmer palette than the original near-black green — chosen to sit
// visually closer to the white-card/purple-gradient theme used everywhere
// else in the app (menu, waiting room, shop bar) instead of reading as a
// completely separate dark "game mode".
export const LANE_COLOR = 0x7cb06a;
export const LANE_COLOR_ALT = 0x6fa062; // alternating row shade for the 5-lane checkerboard
export const SLOT_MARKER_COLOR = 0xf2f5ee;

// Fixed logical game resolution. The backend sends entity coordinates in this
// space (see NETWORKING_CONTRACT_REVISED.md "Constants (Shared)"). The Phaser
// game is configured with Scale.FIT at this size so entity coordinates always
// line up with the rendered lane, regardless of the browser window size.
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 400;

export const PLANT_SPRITE_SIZE = 3;
export const ZOMBIE_SPRITE_SIZE = 1;
export const PROJECTILE_RADIUS = 8;

// All three plant sprite sheets (peashooter, sunflower, wallnut) are now
// consistently ~18-21px pixel-art PNGs, so a single uniform PLANT_SPRITE_SIZE
// multiplier applies evenly to all of them (~54-63px rendered, fitting inside
// one ~88x80px grid cell). No per-plant multiplier needed — this used to be
// required when sunflower/wallnut were 128x128 SVGs on a totally different
// scale from peashooter's pixel art, but that's no longer the case.
export const PLANT_SCALE_MULTIPLIERS = {
  peashooter: 1,
  sunflower: 1,
  wallnut: 1,
};

// Collectible sun (see backend/src/game/config/gameConfig.ts SUN_PICKUP_RADIUS
// — must match, since the hover/tap hit-test happens client-side for instant
// feedback and the server independently re-validates range on 'collect_sun').
export const SUN_COLOR = 0xffd54f;
export const SUN_PICKUP_RADIUS = 26;
// The sun art (assets/sprites/ItemTextures/sun/idle/frame-0.png) is a 50x50
// PNG, so the scale that makes it fill its hit circle is
// (SUN_PICKUP_RADIUS * 2) / 50.
//
// This used to be 0.42, carried over from when the art really was a 128x128
// SVG. When the asset was swapped for the 50px PNG the scale wasn't retuned,
// so sun rendered at 21px inside a 52px hit target — less than half the size
// it was supposed to be, and much harder to spot on the board than intended.
export const SUN_SPRITE_SCALE = (SUN_PICKUP_RADIUS * 2) / 50;

// Plant matter pickup (see backend PLANT_MATTER_PICKUP_RADIUS — must match,
// same client-side-instant/server-revalidates hit-test pattern as sun).
export const PLANT_MATTER_COLOR = 0x4a8f52;
export const PLANT_MATTER_PICKUP_RADIUS = 26;
// assets/sprites/ItemTextures/plantmatter/idle/frame-0.svg is a 64x64 native
// SVG. Same retune as SUN_SPRITE_SCALE above — 0.42 rendered it at 27px
// inside a 52px hit circle.
export const PLANT_MATTER_SPRITE_SCALE = (PLANT_MATTER_PICKUP_RADIUS * 2) / 64;

export const HP_LABEL_OFFSET = {
  plant: { x: 0, y: -42 },
  zombie: { x: 0, y: -40 },
};

// --- Board layout ----------------------------------------------------------
//
// Deliberately empty of coordinates. LANE_MARGIN, LANE_SPACING, SLOT_MARGIN,
// SLOT_SPACING, getLaneY() and getSlotPositions() used to live here, hand-kept
// in sync with the server's identical formulas in gameConfig.ts. That sync was
// unenforced and silent when broken. The server sends every slot's x/y in each
// state_update, so the client reads geometry from boardLayout.js instead of
// deriving it — see the header comment there.
//
// SLOT_RADIUS stays because it's an interaction affordance (how close a click
// counts as hitting a slot), not a position, and the server does not send it.
export const LANE_COUNT = 5;
export const SLOT_COUNT = 8; // per lane
export const SLOT_RADIUS = 30; // click-hit radius around a slot center

// --- Slingshot (tuning only — the anchor position comes from the server) ---
// SLINGSHOT_X/Y and SLINGSHOT_LANE_INDEX are gone from here for the same
// reason as the grid above: the fork's position is board geometry, so it
// arrives on `state_update` as `slingshot: {x, y}` and is read via
// getSlingshotAnchor(). The values below are shot-feel tuning that must match
// slingshotConfig.ts so the drag preview matches the server's simulation.
export const SLINGSHOT_MAX_PULL = 140;
export const SLINGSHOT_MIN_PULL_X = 18;
// rawTarget = anchor - pull * RANGE_MULTIPLIER. Tuned so MAX_PULL reaches the
// far column/row from the anchor with room to spare. Dragging past the
// canvas's left edge still works because the drag captures the pointer (see
// tryStartSlingshotDrag in GameScene.js).
export const SLINGSHOT_RANGE_MULTIPLIER = 6;
// Same distance->duration/height scaling the server uses, so the client's
// live trajectory preview while dragging matches the real flight exactly.
export const SLINGSHOT_BASE_FLIGHT_TICKS = 14;
export const SLINGSHOT_FLIGHT_TICKS_PER_100PX = 6;
export const SLINGSHOT_ZMAX_BASE = 40;
export const SLINGSHOT_ZMAX_PER_100PX = 20;
export const SLINGSHOT_TICK_RATE = 20; // must match backend TICK_RATE default

export const BIRD_RADIUS = 14;
export const BIRD_COLOR = 0x2f6fed;
export const SLINGSHOT_GRAB_RADIUS = 34; // pointerdown hit-test radius around the resting bird
export const TRAJECTORY_DOT_COUNT = 14;
export const TRAJECTORY_DOT_COLOR = 0xffffff;
export const SLINGSHOT_BAND_COLOR = 0x8a5a2e;