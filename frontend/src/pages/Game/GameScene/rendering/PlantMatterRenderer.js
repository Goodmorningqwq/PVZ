import { PLANT_MATTER_COLOR, PLANT_MATTER_PICKUP_RADIUS, PLANT_MATTER_SPRITE_SCALE } from '../constants';
import { BaseRenderer } from './BaseRenderer';
import { getAnimationKey, getPlantAnimationStates } from './spriteFrames';

const IDLE_STATE = 'idle';
const PLANT_MATTER_ASSET_NAME = 'plantmatter';

function getIdleAnimationKey() {
  const hasIdleAnimation = getPlantAnimationStates(PLANT_MATTER_ASSET_NAME).includes(IDLE_STATE);
  return hasIdleAnimation ? getAnimationKey(PLANT_MATTER_ASSET_NAME, IDLE_STATE) : null;
}

// Plant matter pickups: dropped by killed zombies, collected the same
// hover/tap way sun is. Mirrors SunRenderer's "hop out and land" entrance
// (spawn offset above the drop point, tween down onto the server-authoritative
// resting x/y, which also doubles as the collection hit-test point) so the
// two pickup types read as the same family of collectible while still being
// visually distinct (real art from assets/sprites/ItemTextures/plantmatter/idle/,
// plus a different color for the circle fallback).
export class PlantMatterRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.defaultScale = PLANT_MATTER_SPRITE_SCALE;
  }

  // See SunRenderer.renderSun for why `size` is deliberately ignored here too.
  renderPlantMatter(entity) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    let cachedSprite = this.spriteCache.get(id);
    if (!cachedSprite) {
      const animationKey = getIdleAnimationKey();
      const sprite = animationKey
        ? this.scene.add.sprite(entity.x, entity.y).play(animationKey)
        : this.scene.add.circle(entity.x, entity.y, PLANT_MATTER_PICKUP_RADIUS, PLANT_MATTER_COLOR).setStrokeStyle(3, 0x255c2b);

      sprite.setOrigin(0.5);
      sprite.setScale(this.defaultScale);

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

      hopTween.setCallback('onComplete', () => {
        cachedSprite.landed = true;
      });

      return sprite;
    }

    // Same reasoning as SunRenderer: don't fight the hop tween with repeated
    // setPosition calls on every state_update.
    return cachedSprite.sprite;
  }

  cleanup(id) {
    const cachedSprite = this.spriteCache.get(id);
    cachedSprite?.hopTween?.stop();
    super.cleanup(id);
  }
}
