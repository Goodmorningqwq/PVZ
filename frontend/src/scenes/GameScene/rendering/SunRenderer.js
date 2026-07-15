import { SUN_COLOR, SUN_PICKUP_RADIUS } from '../constants';
import { BaseRenderer } from './BaseRenderer';

// Sun pickups: a bright, gently pulsing circle so it reads as "collectible"
// at a glance (classic PvZ sun has the same "come get me" pulse). Collection
// itself isn't handled here — GameScene checks hover/tap distance against
// the same positions this renders and fires emitCollectSun separately.
export class SunRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.defaultScale = 1;
  }

  renderSun(entity, size = this.defaultScale) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    let cachedSprite = this.spriteCache.get(id);
    if (!cachedSprite) {
      const sprite = this.scene.add
        .circle(entity.x, entity.y, SUN_PICKUP_RADIUS, SUN_COLOR)
        .setStrokeStyle(3, 0xffb300);
      sprite.setScale(size);
      sprite.setOrigin(0.5);

      const tween = this.scene.tweens.add({
        targets: sprite,
        scale: { from: size * 0.85, to: size * 1.05 },
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      cachedSprite = { sprite, tween };
      this.spriteCache.set(id, cachedSprite);
    }

    cachedSprite.sprite.setPosition(entity.x, entity.y);
    return cachedSprite.sprite;
  }

  cleanup(id) {
    const cachedSprite = this.spriteCache.get(id);
    cachedSprite?.tween?.stop();
    super.cleanup(id);
  }
}
