import Phaser from 'phaser';
import { emitCollectSun, emitPlacePlant, getLatestState } from '../../../network';
import {
  GRASS_COLOR,
  LANE_COLOR,
  LANE_COLOR_ALT,
  LANE_COUNT,
  LANE_SPACING,
  SLOT_MARGIN,
  SLOT_MARKER_COLOR,
  SLOT_RADIUS,
  SUN_PICKUP_RADIUS,
  getLaneY,
  getSlotPositions,
} from './constants';
import { PlantRenderer, ProjectileRenderer, SunRenderer, ZombieRenderer, createPlantAnimations, preloadPlantAnimations } from './rendering';
import { normalizeSun, toStringId } from './utils';

const SLOT_POSITIONS = getSlotPositions();

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.lastRenderedTick = -1;
    this.activePlants = new Map();
    this.activeZombies = new Map();
    this.activeSunPickups = new Map();
    this.latestSunPickups = [];
    // Sun ids already sent to the server via collect_sun this "life" of the
    // pickup — hover fires every update tick while the cursor rests over a
    // sun, so without this guard we'd spam the socket dozens of times a
    // second instead of once. Pruned in renderState() once the pickup is
    // gone (collected or expired).
    this.requestedSunIds = new Set();
  }

  preload() {
    preloadPlantAnimations(this);
  }

  create() {
    createPlantAnimations(this);

    this.plantRenderer = new PlantRenderer(this);
    this.projectileRenderer = new ProjectileRenderer(this);
    this.sunRenderer = new SunRenderer(this);
    this.zombieRenderer = new ZombieRenderer(this);

    this.cameras.main.setBackgroundColor('#2f4a2a');
    this.background = this.add.graphics();
    this.slotMarkers = this.add.graphics();

    this.drawBackground();
    this.drawSlotMarkers();
    this.input.on('pointerdown', this.handlePointerDown, this);
    // Hover collection (desktop/mouse). Tap collection for touch devices —
    // which have no hover concept — is handled in handlePointerDown below.
    this.input.on('pointermove', this.handlePointerMove, this);
  }

  update() {
    const latestState = getLatestState();

    if (latestState.tick === this.lastRenderedTick) {
      return;
    }

    this.renderState(latestState);
  }

  renderState(latestState) {
    const slots = Array.isArray(latestState?.slots) ? latestState.slots : [];
    const zombies = Array.isArray(latestState?.zombies) ? latestState.zombies : [];
    const tick = Number.isFinite(latestState?.tick) ? latestState.tick : 0;

    this.lastRenderedTick = tick;
    this.latestSlots = slots;
    const projectiles = Array.isArray(latestState?.projectiles) ? latestState.projectiles : [];
    const sunPickups = Array.isArray(latestState?.sunPickups) ? latestState.sunPickups : [];
    this.latestSunPickups = sunPickups;

    // Drop any "already requested" guard for suns that are no longer in the
    // latest state (collected, expired, or — extremely unlikely — a ~stale
    // request that never landed) so a future spawn can't get permanently
    // stuck unrequestable.
    const livePickupIds = new Set(sunPickups.map((pickup) => pickup.id));
    for (const requestedId of this.requestedSunIds) {
      if (!livePickupIds.has(requestedId)) {
        this.requestedSunIds.delete(requestedId);
      }
    }

    this.game.events.emit('hud-update', {
      tick,
      sun: normalizeSun(latestState?.sun),
      plantDefs: latestState?.plantDefs && typeof latestState.plantDefs === 'object' ? latestState.plantDefs : {},
      wave: Number.isFinite(latestState?.wave) ? latestState.wave : 0,
      waveStatus: latestState?.waveStatus || 'pending',
      totalWaves: Number.isFinite(latestState?.totalWaves) ? latestState.totalWaves : 0,
    });

    const plantEntities = slots
      .filter((slot) => slot.plant)
      .map((slot) => ({
        id: `slot-${slot.index}`,
        x: slot.x,
        y: slot.y,
        type: slot.plant.type,
        hp: slot.plant.hp,
      }));

    this.syncSprites(
      this.activePlants,
      plantEntities,
      (entity) => this.plantRenderer.renderPlant(entity),
      (id) => this.plantRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeProjectiles || (this.activeProjectiles = new Map()),
      projectiles,
      (entity) => this.projectileRenderer.renderProjectile(entity, 1),
      (id) => this.projectileRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeZombies,
      zombies,
      (entity) => this.zombieRenderer.renderZombie(entity, 1),
      (id) => this.zombieRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeSunPickups,
      sunPickups,
      (entity) => this.sunRenderer.renderSun(entity),
      (id) => this.sunRenderer.cleanup(id),
    );
  }

  syncSprites(activeEntities, entities, renderEntity, cleanupEntity) {
    const nextActiveIds = new Set();

    for (const entity of entities) {
      nextActiveIds.add(entity.id);
      renderEntity(entity);
    }

    for (const id of activeEntities.keys()) {
      if (!nextActiveIds.has(id)) {
        cleanupEntity(id);
      }
    }

    activeEntities.clear();
    for (const entity of entities) {
      activeEntities.set(entity.id, entity);
    }
  }

  // Shared by hover (pointermove) and tap (pointerdown, for touch devices
  // with no hover concept) — finds the nearest not-yet-requested sun pickup
  // within range and fires collect_sun for it. Returns true if a sun was
  // targeted, so callers (like handlePointerDown) can skip other tap
  // behavior — e.g. don't also try to place a plant on the same tap.
  tryCollectSunNear(worldX, worldY) {
    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');
    if (!roomId || !playerId) {
      return false;
    }

    const pickup = this.latestSunPickups.find((candidate) => {
      if (this.requestedSunIds.has(candidate.id)) {
        return false;
      }
      const dx = candidate.x - worldX;
      const dy = candidate.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= SUN_PICKUP_RADIUS;
    });

    if (!pickup) {
      return false;
    }

    this.requestedSunIds.add(pickup.id);
    emitCollectSun({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      sunId: pickup.id,
      x: pickup.x,
      y: pickup.y,
    });
    return true;
  }

  handlePointerMove(pointer) {
    this.tryCollectSunNear(pointer.worldX, pointer.worldY);
  }

  handlePointerDown(pointer) {
    // Tap-to-collect for touch devices (no hover event ever fires there).
    // On desktop this is usually a no-op since hover already requested the
    // sun the moment the cursor entered range, but it's a harmless second
    // check either way thanks to the requestedSunIds guard.
    if (this.tryCollectSunNear(pointer.worldX, pointer.worldY)) {
      return;
    }

    const selectedPlant = this.registry.get('selectedPlant');
    if (!selectedPlant) {
      return;
    }

    const slot = SLOT_POSITIONS.find((candidate) => {
      const dx = candidate.x - pointer.worldX;
      const dy = candidate.y - pointer.worldY;
      return Math.sqrt(dx * dx + dy * dy) <= SLOT_RADIUS;
    });

    if (!slot) {
      return;
    }

    const occupied = (this.latestSlots || []).some((s) => s.index === slot.index && s.plant);
    if (occupied) {
      return;
    }

    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');
    if (!roomId || !playerId) {
      return;
    }

    emitPlacePlant({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      plant: selectedPlant,
      slotIndex: slot.index,
    });
  }

  drawSlotMarkers() {
    // Styled like the app's input/dashed-box treatment (.menu-pin-input,
    // .waiting-code) rather than a bare thin outline, so open slots read as
    // "placeholder cards" consistent with the rest of the UI.
    this.slotMarkers.clear();
    for (const slot of SLOT_POSITIONS) {
      this.slotMarkers.fillStyle(0xffffff, 0.14);
      this.slotMarkers.fillCircle(slot.x, slot.y, SLOT_RADIUS);
      this.slotMarkers.lineStyle(2, SLOT_MARKER_COLOR, 0.55);
      this.slotMarkers.strokeCircle(slot.x, slot.y, SLOT_RADIUS);
    }
  }

  drawBackground() {
    const { width, height } = this.scale;
    const laneWidth = Math.max(width - SLOT_MARGIN * 2, 0);

    this.background.clear();
    this.background.fillStyle(GRASS_COLOR, 1);
    this.background.fillRect(0, 0, width, height);

    // 5-row checkerboard lane grid, alternating shades so each zombie lane
    // reads clearly (matches the classic PvZ board proportions).
    for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
      const laneY = getLaneY(laneIndex);
      const rowTop = Math.max(0, laneY - LANE_SPACING / 2);
      const rowBottom = Math.min(height, laneY + LANE_SPACING / 2);
      this.background.fillStyle(laneIndex % 2 === 0 ? LANE_COLOR : LANE_COLOR_ALT, 1);
      this.background.fillRect(SLOT_MARGIN, rowTop, laneWidth, Math.max(rowBottom - rowTop, 0));
    }
  }
}
