import { PROJECTILE_COLOR, PROJECTILE_RADIUS } from '../constants';
import { BaseRenderer } from './BaseRenderer';

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
