import { HP_LABEL_OFFSET, ZOMBIE_COLOR, ZOMBIE_SPRITE_SIZE } from '../constants';
import { BaseRenderer } from './BaseRenderer';

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
