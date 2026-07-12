import { HP_LABEL_OFFSET, PLANT_ASSET_KEYS, PLANT_SPRITE_SIZE, PROJECTILE_COLOR, PROJECTILE_RADIUS, ZOMBIE_COLOR, ZOMBIE_SPRITE_SIZE } from './constants';

function getAssetKey(entityType, availableAssets) {
  const normalizedType = String(entityType ?? '').toLowerCase();
  if (availableAssets.has(normalizedType)) {
    return normalizedType;
  }

  return availableAssets.has('peashooter') ? 'peashooter' : null;
}

class BaseRenderer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.assetsPath = options.assetsPath || '';
    this.spriteCache = new Map();
  }

  updateHealthLabel(sprite, hp, x, y) {
    if (!sprite?.hpLabel) {
      return;
    }

    sprite.hpLabel.setText(String(hp ?? ''));
    sprite.hpLabel.setPosition(x + this.labelOffset.x, y + this.labelOffset.y);
  }

  cleanup(id) {
    const cachedSprite = this.spriteCache.get(id);
    if (!cachedSprite) {
      return;
    }

    cachedSprite.hpLabel?.destroy();
    cachedSprite.sprite?.destroy();
    this.spriteCache.delete(id);
  }

  clearAll() {
    for (const id of this.spriteCache.keys()) {
      this.cleanup(id);
    }
  }
}

export class PlantRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.labelOffset = HP_LABEL_OFFSET.plant;
    this.defaultScale = PLANT_SPRITE_SIZE;
    this.availableAssets = new Set(PLANT_ASSET_KEYS);
  }

  renderPlant(entity, size = this.defaultScale) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    const textureKey = getAssetKey(entity.type, this.availableAssets);
    const cachedSprite = this.spriteCache.get(id);

    if (cachedSprite && cachedSprite.textureKey !== textureKey) {
      this.cleanup(id);
    }

    let activeSprite = this.spriteCache.get(id);
    if (!activeSprite) {
      const sprite = textureKey
        ? this.scene.add.image(entity.x, entity.y, textureKey)
        : this.scene.add.rectangle(entity.x, entity.y, 44, 74, 0x5d8d58).setStrokeStyle(2, 0xd5e8c7);

      sprite.setScale(size);
      sprite.setOrigin(0.5);

      const hpLabel = this.scene.add
        .text(entity.x + this.labelOffset.x, entity.y + this.labelOffset.y, String(entity.hp ?? ''), {
          color: '#f4ffe9',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          fontStyle: '700',
        })
        .setOrigin(0.5);

      activeSprite = { sprite, hpLabel, textureKey };
      this.spriteCache.set(id, activeSprite);
    }

    activeSprite.sprite.setPosition(entity.x, entity.y);
    activeSprite.sprite.setScale(size);
    this.updateHealthLabel(activeSprite.sprite, entity.hp, entity.x, entity.y);
    return activeSprite.sprite;
  }
}

export class ZombieRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.labelOffset = HP_LABEL_OFFSET.zombie;
    this.defaultScale = ZOMBIE_SPRITE_SIZE;
  }

  renderZombie(entity, size = this.defaultScale) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    let cachedSprite = this.spriteCache.get(id);
    if (!cachedSprite) {
      const sprite = this.scene.add.rectangle(entity.x, entity.y, 40, 68, ZOMBIE_COLOR).setStrokeStyle(2, 0x3a2517);
      sprite.setScale(size);
      sprite.setOrigin(0.5);

      const hpLabel = this.scene.add
        .text(entity.x + this.labelOffset.x, entity.y + this.labelOffset.y, String(entity.hp ?? ''), {
          color: '#fff2e1',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: '700',
        })
        .setOrigin(0.5);

      cachedSprite = { sprite, hpLabel };
      this.spriteCache.set(id, cachedSprite);
    }

    cachedSprite.sprite.setPosition(entity.x, entity.y);
    cachedSprite.sprite.setScale(size);
    this.updateHealthLabel(cachedSprite.sprite, entity.hp, entity.x, entity.y);
    return cachedSprite.sprite;
  }
}

export class ProjectileRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.defaultScale = 1;
  }

  renderProjectile(entity, size = this.defaultScale) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    let cachedSprite = this.spriteCache.get(id);
    if (!cachedSprite) {
      const sprite = this.scene.add.circle(entity.x, entity.y, PROJECTILE_RADIUS, PROJECTILE_COLOR).setStrokeStyle(1, 0x2e7d32);
      sprite.setScale(size);
      sprite.setOrigin(0.5);

      cachedSprite = { sprite };
      this.spriteCache.set(id, cachedSprite);
    }

    cachedSprite.sprite.setPosition(entity.x, entity.y);
    cachedSprite.sprite.setScale(size);
    return cachedSprite.sprite;
  }
}