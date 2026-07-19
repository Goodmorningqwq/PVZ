import { SUN_PICKUP_RADIUS, SUN_SPRITE_SCALE } from '../constants';
import { BaseRenderer } from './BaseRenderer';
import { getAnimationKey, getPlantAnimationStates } from './spriteFrames';

const IDLE_STATE = 'idle';
const SUN_ASSET_NAME = 'sun';

function getIdleAnimationKey() {
  const hasIdleAnimation = getPlantAnimationStates(SUN_ASSET_NAME).includes(IDLE_STATE);
  return hasIdleAnimation ? getAnimationKey(SUN_ASSET_NAME, IDLE_STATE) : null;
}

// Sun pickups: real art (assets/sprites/ItemTextures/sun/idle/frame-*.svg — same
// discovery/animation pipeline PlantRenderer uses, "sun" just isn't a
// placeable plant) instead of a plain circle, plus a "popped out" entrance:
// classic PvZ sun doesn't just appear sitting on the sunflower, it hops out
// and lands nearby. The server always sends the final resting x/y (that's
// also the collection hit-test position), so the hop is purely cosmetic —
// spawn a little above/beside that point and tween down onto it once.
export class SunRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.defaultScale = SUN_SPRITE_SCALE;
  }

  // Note: unlike PlantRenderer/ZombieRenderer, `size` here is deliberately
  // ignored in favor of SUN_SPRITE_SCALE directly — GameScene calls every
  // renderX(entity, 1) uniformly, which would silently override the
  // SUN_SPRITE_SCALE default (default params only apply when the argument is
  // omitted, not when it's explicitly 1).
  renderSun(entity) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    let cachedSprite = this.spriteCache.get(id);
    if (!cachedSprite) {
      const animationKey = getIdleAnimationKey();
      const sprite = animationKey
        ? this.scene.add.sprite(entity.x, entity.y).play(animationKey)
        : this.scene.add.circle(entity.x, entity.y, SUN_PICKUP_RADIUS, 0xffd54f).setStrokeStyle(3, 0xffb300);

      sprite.setOrigin(0.5);
      sprite.setScale(this.defaultScale);

      // Land a little above and to one side of the final spot, alternating
      // sides randomly so a burst of sun from one sunflower doesn't all hop
      // the same direction — a small stand-in for a real arc/parabola.
      const hopSide = Math.random() < 0.5 ? -1 : 1;
      const spawnX = entity.x + hopSide * (16 + Math.random() * 12);
      const spawnY = entity.y - (46 + Math.random() * 14);
      sprite.setPosition(spawnX, spawnY);

      const hopTween = this.scene.tweens.add({
        targets: sprite,
        x: entity.x,
        y: entity.y,
        duration: 480,
        ease: 'Cubic.easeOut',
      });

      cachedSprite = { sprite, hopTween, landed: false };
      this.spriteCache.set(id, cachedSprite);

      // Once landed, sun pickups are stationary (the server never moves
      // them), so we deliberately stop syncing position after this — see
      // below, this is the only setPosition call for the lifetime of a sun.
      hopTween.setCallback('onComplete', () => {
        cachedSprite.landed = true;
      });

      return sprite;
    }

    // Do NOT setPosition here while the hop tween is still running — every
    // renderSun() call happens on every state_update (many times a second),
    // and forcing position back to entity.x/y each time would fight the
    // tween and make the sun snap in place instead of hopping.
    return cachedSprite.sprite;
  }

  cleanup(id) {
    const cachedSprite = this.spriteCache.get(id);
    cachedSprite?.hopTween?.stop();
    super.cleanup(id);
  }
}
