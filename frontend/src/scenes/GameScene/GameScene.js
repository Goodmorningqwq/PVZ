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
import { PlantRenderer, ZombieRenderer } from './rendering';
import { normalizeSun, toStringId } from './utils';

const SLOT_POSITIONS = getSlotPositions();

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.lastRenderedTick = -1;
    this.demoState = null;
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
    this.demoMode = Boolean(this.registry.get('demoMode'));
    this.plantRenderer = new PlantRenderer(this);
    this.zombieRenderer = new ZombieRenderer(this);

    this.cameras.main.setBackgroundColor('#2f4a2a');
    this.background = this.add.graphics();
    this.slotMarkers = this.add.graphics();

    this.drawBackground();
    this.drawSlotMarkers();
    this.input.on('pointerdown', this.handlePointerDown, this);

    if (this.demoMode) {
      this.demoState = this.createDemoState();
      this.renderState(this.demoState);
    }
  }

  update() {
    const latestState = this.demoMode ? this.demoState : getLatestState();

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

    if (this.demoMode) {
      this.addDemoPlant(slot.index, selectedPlant, this.registry.get('playerId') || 'demo-player');
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

  createDemoState() {
    const playerId = toStringId(this.registry.get('playerId')) || 'demo-player';
    const opponentId = toStringId(this.registry.get('opponentId')) || 'demo-opponent';

    const slots = SLOT_POSITIONS.map((position) => ({ ...position, plant: null }));
    // Lane 0, col 1 / col 2; lane 2, col 1 — a couple of plants spread
    // across different lanes so the demo shows the 5-lane grid at a glance.
    const sunflowerSlot = slots.find((s) => s.laneIndex === 0 && s.index === 1);
    const peashooterSlot = slots.find((s) => s.laneIndex === 0 && s.index === 2);
    const secondPeashooterSlot = slots.find((s) => s.laneIndex === 2 && s.index === 2 + 2 * 8);
    if (sunflowerSlot) sunflowerSlot.plant = { type: 'sunflower', hp: 100, ownerId: playerId };
    if (peashooterSlot) peashooterSlot.plant = { type: 'peashooter', hp: 100, ownerId: opponentId };
    if (secondPeashooterSlot) secondPeashooterSlot.plant = { type: 'peashooter', hp: 100, ownerId: playerId };

    return {
      tick: 1,
      sun: { [playerId]: 150, [opponentId]: 150 }, // matches backend STARTING_SUN
      slots,
      zombies: [
        { id: 'z1', laneIndex: 0, x: 700, y: getLaneY(0), hp: 20 },
        { id: 'z2', laneIndex: 2, x: 620, y: getLaneY(2), hp: 20 },
        { id: 'z3', laneIndex: 4, x: 740, y: getLaneY(4), hp: 20 },
      ],
      wave: 1,
      waveStatus: 'spawning',
      totalWaves: 3,
    };
  }

  addDemoPlant(slotIndex, plantType, ownerId) {
    if (!this.demoState) {
      return;
    }

    const nextSlots = this.demoState.slots.map((slot) =>
      slot.index === slotIndex && !slot.plant
        ? { ...slot, plant: { type: plantType, hp: 100, ownerId } }
        : slot,
    );

    this.demoState = { ...this.demoState, slots: nextSlots, tick: this.demoState.tick + 1 };
    this.renderState(this.demoState);
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
