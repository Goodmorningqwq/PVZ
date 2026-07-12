import Phaser from 'phaser';
import { emitPlacePlant, getLatestState } from '../../network';
import { GRASS_COLOR, LANE_COLOR, PLANT_ASSET_KEYS } from './constants';
import { PlantRenderer, ZombieRenderer } from './rendering';
import { normalizeEntities, normalizeSun, toFiniteNumber, toStringId } from './utils';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.lastRenderedTick = -1;
    this.demoState = null;
    this.activeTowers = new Map();
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
    this.staticText = this.add.text(24, 20, '', {
      color: '#eaf4db',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
    });
    this.hintText = this.add.text(24, 46, 'Click anywhere to request a peashooter placement.', {
      color: '#a8b89e',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
    });

    this.gameOverPanel = null;
    this.gameOverText = null;

    this.drawBackground();
    this.scale.on('resize', this.drawBackground, this);
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
    const normalizedState = {
      tick: Number.isFinite(latestState?.tick) ? latestState.tick : 0,
      sun: normalizeSun(latestState?.sun),
      towers: normalizeEntities(latestState?.towers),
      zombies: normalizeEntities(latestState?.zombies),
    };

    this.lastRenderedTick = normalizedState.tick;

    const roomId = toStringId(this.registry.get('roomId'));
    const playerId = toStringId(this.registry.get('playerId'));
    const sunEntries = Object.entries(normalizedState.sun || {});
    const sunText = sunEntries.length > 0 ? sunEntries.map(([id, value]) => `${id}: ${value}`).join(' | ') : 'no sun data';
    const modeLabel = this.demoMode ? 'Demo mode: local rendering only' : 'Live mode: server state';

    this.staticText.setText(`Tick: ${normalizedState.tick}\nRoom: ${roomId}\nPlayer: ${playerId}\nSun: ${sunText}\n${modeLabel}`);
    this.syncSprites(
      this.activeTowers,
      normalizedState.towers,
      (entity) => this.plantRenderer.renderPlant(entity, 1),
      (id) => this.plantRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeZombies,
      normalizedState.zombies,
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
    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');

    if (this.demoMode) {
      this.addDemoPlant(Math.round(pointer.worldX), Math.round(pointer.worldY), playerId || 'demo-player');
      return;
    }

    if (!roomId || !playerId) {
      return;
    }

    emitPlacePlant({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      x: toFiniteNumber(pointer.worldX) ?? Math.round(pointer.worldX),
      y: toFiniteNumber(pointer.worldY) ?? Math.round(pointer.worldY),
    });
  }

  createDemoState() {
    const playerId = toStringId(this.registry.get('playerId')) || 'demo-player';
    const opponentId = toStringId(this.registry.get('opponentId')) || 'demo-opponent';

    return {
      tick: 1,
      sun: {
        [playerId]: 50,
        [opponentId]: 50,
      },
      towers: [
        { id: 't1', x: 220, y: 180, type: 'peashooter', owner: playerId, hp: 100 },
        { id: 't2', x: 360, y: 180, type: 'sunflower', owner: opponentId, hp: 100 },
      ],
      zombies: [
        { id: 'z1', x: 610, y: 180, hp: 20 },
      ],
    };
  }

  addDemoPlant(x, y, owner) {
    if (!this.demoState) {
      return;
    }

    const nextIndex = this.demoState.towers.length + 1;
    this.demoState = {
      ...this.demoState,
      towers: [
        ...this.demoState.towers,
        {
          id: `demo_t${nextIndex}`,
          x,
          y,
          type: nextIndex % 3 === 0 ? 'wallnut' : 'peashooter',
          owner,
          hp: 100,
        },
      ],
    };

    this.renderState(this.demoState);
  }

  showGameOver({ winnerId, reason }) {
    if (this.gameOverPanel) {
      return;
    }

    const { width, height } = this.scale;
    this.gameOverPanel = this.add.rectangle(width / 2, height / 2, 440, 180, 0x0f1710, 0.9).setStrokeStyle(2, 0xd8e8c8);
    this.gameOverText = this.add
      .text(width / 2, height / 2, `Game Over\nWinner: ${winnerId || 'unknown'}\nReason: ${reason || 'unknown'}`, {
        align: 'center',
        color: '#f2f7ea',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
      })
      .setOrigin(0.5);
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