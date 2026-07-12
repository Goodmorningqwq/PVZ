import Phaser from 'phaser';
import { emitPlacePlant, getLatestState } from '../../network';
import { GRASS_COLOR, LANE_COLOR, PLANT_ASSET_KEYS, SLOT_RADIUS, getSlotPositions } from './constants';
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

    this.cameras.main.setBackgroundColor('#18251a');
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
    slots[1].plant = { type: 'sunflower', hp: 100, ownerId: playerId };
    slots[2].plant = { type: 'peashooter', hp: 100, ownerId: opponentId };

    return {
      tick: 1,
      sun: { [playerId]: 50, [opponentId]: 50 },
      slots,
      zombies: [{ id: 'z1', x: 700, y: 200, hp: 20 }],
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
    this.slotMarkers.clear();
    this.slotMarkers.lineStyle(2, 0xaebf9d, 0.35);
    for (const slot of SLOT_POSITIONS) {
      this.slotMarkers.strokeCircle(slot.x, slot.y, SLOT_RADIUS);
    }
  }

  drawBackground() {
    const { width, height } = this.scale;
    this.background.clear();
    this.background.fillStyle(GRASS_COLOR, 1);
    this.background.fillRect(0, 0, width, height);
    this.background.fillStyle(LANE_COLOR, 1);
    this.background.fillRoundedRect(48, height * 0.5 - 70, Math.max(width - 96, 0), 140, 24);
    this.background.fillStyle(0x354c2e, 1);
    this.background.fillRect(48, height * 0.5 - 3, Math.max(width - 96, 0), 6);
  }
}
