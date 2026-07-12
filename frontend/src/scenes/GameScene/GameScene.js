import Phaser from 'phaser';
import { emitPlacePlant, getLatestState } from '../../network';
import {
  GRASS_COLOR,
  LANE_COLOR,
  LANE_COLOR_ALT,
  LANE_COUNT,
  LANE_SPACING,
  PLANT_ASSET_KEYS,
  SLOT_MARGIN,
  SLOT_MARKER_COLOR,
  SLOT_RADIUS,
  getLaneY,
  getSlotPositions,
} from './constants';
import { PlantRenderer, ProjectileRenderer, ZombieRenderer } from './rendering';
import { normalizeSun, toStringId } from './utils';

const SLOT_POSITIONS = getSlotPositions();

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.lastRenderedTick = -1;
    this.activePlants = new Map();
    this.activeZombies = new Map();
  }

  preload() {
    for (const key of PLANT_ASSET_KEYS) {
      const assetUrl = new URL(`../../assets/plants/${key}.svg`, import.meta.url).href;
      this.load.svg(key, assetUrl, { width: 128, height: 128 });
    }
  }

  create() {
    this.plantRenderer = new PlantRenderer(this);
    this.projectileRenderer = new ProjectileRenderer(this);
    this.zombieRenderer = new ZombieRenderer(this);

    this.cameras.main.setBackgroundColor('#2f4a2a');
    this.background = this.add.graphics();
    this.slotMarkers = this.add.graphics();

    this.drawBackground();
    this.drawSlotMarkers();
    this.input.on('pointerdown', this.handlePointerDown, this);
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

    this.game.events.emit('hud-update', {
      tick,
      sun: normalizeSun(latestState?.sun),
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
      (entity) => this.plantRenderer.renderPlant(entity, 1),
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

  handlePointerDown(pointer) {
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
