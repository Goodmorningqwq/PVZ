import { HP_LABEL_OFFSET, PLANT_SCALE_MULTIPLIERS, PLANT_SPRITE_SIZE } from '../constants';
import { BaseRenderer } from './BaseRenderer';
import { getAnimationKey, getPlantAnimationStates } from './spriteFrames';

const IDLE_STATE = 'idle';

function normalizePlantName(entityType) {
  return String(entityType ?? '').toLowerCase();
}

function getIdleAnimationKey(entityType) {
  const plantName = normalizePlantName(entityType);
  const hasIdleAnimation = getPlantAnimationStates(plantName).includes(IDLE_STATE);
  return hasIdleAnimation ? getAnimationKey(plantName, IDLE_STATE) : null;
}

function getScaleMultiplier(entityType) {
  return PLANT_SCALE_MULTIPLIERS[normalizePlantName(entityType)] ?? 1;
}

export class PlantRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.labelOffset = HP_LABEL_OFFSET.plant;
    this.defaultScale = PLANT_SPRITE_SIZE;
  }

  renderPlant(entity, size = this.defaultScale) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    const animationKey = getIdleAnimationKey(entity.type);
    const effectiveScale = size * getScaleMultiplier(entity.type);
    const cachedSprite = this.spriteCache.get(id);

    if (cachedSprite && cachedSprite.animationKey !== animationKey) {
      this.cleanup(id);
    }

    let activeSprite = this.spriteCache.get(id);
    if (!activeSprite) {
      const sprite = animationKey
        ? this.scene.add.sprite(entity.x, entity.y).play(animationKey)
        : this.scene.add.rectangle(entity.x, entity.y, 44, 74, 0x5d8d58).setStrokeStyle(2, 0xd5e8c7);

      sprite.setScale(effectiveScale);
      sprite.setOrigin(0.5);

      const hpLabel = this.scene.add
        .text(entity.x + this.labelOffset.x, entity.y + this.labelOffset.y, String(entity.hp ?? ''), {
          color: '#f4ffe9',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          fontStyle: '700',
        })
        .setOrigin(0.5);

      // BaseRenderer.updateHealthLabel() reads `sprite.hpLabel`, so it must live
      // on the sprite itself, not just as a sibling in this wrapper object —
      // otherwise the label is created once and then never repositioned or
      // updated again (it was previously passed `activeSprite.sprite`, which
      // has no `hpLabel` property of its own).
      sprite.hpLabel = hpLabel;
      activeSprite = { sprite, hpLabel, animationKey };
      this.spriteCache.set(id, activeSprite);
    }

    activeSprite.sprite.setPosition(entity.x, entity.y);
    activeSprite.sprite.setScale(effectiveScale);
    this.updateHealthLabel(activeSprite.sprite, entity.hp, entity.x, entity.y);
    return activeSprite.sprite;
  }
}
