import {
  BOSS_ZOMBIE_COLOR,
  HP_LABEL_OFFSET,
  ZOMBIE_BODY_HEIGHT_PER_RADIUS,
  ZOMBIE_BODY_WIDTH_PER_RADIUS,
  ZOMBIE_COLOR,
  ZOMBIE_DEFAULT_RADIUS,
  ZOMBIE_SPRITE_SIZE,
} from '../constants';
import { BaseRenderer } from './BaseRenderer';
import { getAnimationKey, getPlantAnimationStates } from './spriteFrames';

// Boss HP bar geometry, in board px.
const BOSS_BAR_HEIGHT = 7;
const BOSS_BAR_GAP = 12; // clearance above the body
const BOSS_BAR_WIDTH_FACTOR = 1.25; // slightly wider than the body

const IDLE_STATE = 'idle';

// Zombie art lives at assets/sprites/ZombieTextures/<type>/idle/frame-N.svg and
// is picked up by the same glob that finds the plants — the category folder is
// discarded by the pattern, so no pipeline change was needed to add it.
// Returns null for a type with no art, which keeps the rectangle fallback
// working for anything unshipped.
function getZombieAnimationKey(entityType) {
  const name = String(entityType ?? '').toLowerCase();
  return getPlantAnimationStates(name).includes(IDLE_STATE) ? getAnimationKey(name, IDLE_STATE) : null;
}

export class ZombieRenderer extends BaseRenderer {
  constructor(scene, assetsPath = '') {
    super(scene, { assetsPath });
    this.labelOffset = HP_LABEL_OFFSET.zombie;
    this.defaultScale = ZOMBIE_SPRITE_SIZE;
  }

  // Body size comes from the server's per-type radius rather than a fixed
  // 40x68, so a brute is visibly bulkier than a shambler and — because the
  // same radius drives the pea and splash hit-tests — what you see is what
  // you can hit.
  //
  // Boss-tier zombies get a proportional HP bar instead of the numeric label.
  // A bare "400" means nothing mid-fight; a draining bar shows progress.
  renderZombie(entity, size = this.defaultScale) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    const radius = Number.isFinite(entity.radius) ? entity.radius : ZOMBIE_DEFAULT_RADIUS;
    const width = radius * ZOMBIE_BODY_WIDTH_PER_RADIUS;
    const height = radius * ZOMBIE_BODY_HEIGHT_PER_RADIUS;
    const isBoss = Boolean(entity.boss);

    let cached = this.spriteCache.get(id);
    if (!cached) {
      const animationKey = getZombieAnimationKey(entity.type);
      let sprite;

      if (animationKey) {
        sprite = this.scene.add.sprite(entity.x, entity.y).play(animationKey);
        // Scale the art to the body size the server's radius implies. Read the
        // natural size off the texture frame rather than hardcoding each SVG's
        // dimensions — frame.width is unaffected by setScale, so this stays
        // correct if the art is ever re-authored at a different size.
        const naturalWidth = sprite.frame?.width || width;
        sprite.setScale(width / naturalWidth);
      } else {
        // No art for this type yet — fall back to the old flat rectangle so a
        // new zombie type is always visible, just plain.
        sprite = this.scene.add
          .rectangle(entity.x, entity.y, width, height, isBoss ? BOSS_ZOMBIE_COLOR : ZOMBIE_COLOR)
          .setStrokeStyle(isBoss ? 3 : 2, isBoss ? 0x4a1f14 : 0x3a2517);
      }

      sprite.setOrigin(0.5);

      cached = { sprite, height, isBoss, animated: Boolean(animationKey), hpLabel: null, barBg: null, barFill: null };

      if (isBoss) {
        const barWidth = width * BOSS_BAR_WIDTH_FACTOR;
        cached.barBg = this.scene.add
          .rectangle(entity.x, entity.y, barWidth, BOSS_BAR_HEIGHT, 0x2a1810, 0.85)
          .setOrigin(0.5);
        // Left-anchored so shrinking the width drains it from the right.
        cached.barFill = this.scene.add
          .rectangle(entity.x, entity.y, barWidth, BOSS_BAR_HEIGHT, 0xd6483b)
          .setOrigin(0, 0.5);
        cached.barWidth = barWidth;
      } else {
        const hpLabel = this.scene.add
          .text(entity.x + this.labelOffset.x, entity.y + this.labelOffset.y, String(entity.hp ?? ''), {
            color: '#fff2e1',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '15px',
            fontStyle: '700',
          })
          .setOrigin(0.5);

        // See PlantRenderer.js for why this must be attached directly to the
        // sprite: BaseRenderer.updateHealthLabel() reads `sprite.hpLabel`.
        sprite.hpLabel = hpLabel;
        cached.hpLabel = hpLabel;
      }

      this.spriteCache.set(id, cached);
    }

    cached.sprite.setPosition(entity.x, entity.y);
    // An art sprite already carries the scale that maps its texture onto the
    // server's body radius; re-applying the caller's `size` here would stomp
    // it and snap every zombie back to raw texture size. The rectangle
    // fallback is built at the right dimensions directly, so `size` only
    // applies to that.
    if (!cached.animated) {
      cached.sprite.setScale(size);
    }

    if (cached.isBoss) {
      const barY = entity.y - (cached.height / 2) - BOSS_BAR_GAP;
      const maxHp = Number.isFinite(entity.maxHp) && entity.maxHp > 0 ? entity.maxHp : 1;
      const fraction = Math.max(0, Math.min(1, (entity.hp ?? 0) / maxHp));

      cached.barBg.setPosition(entity.x, barY);
      cached.barFill.setPosition(entity.x - cached.barWidth / 2, barY);
      cached.barFill.width = cached.barWidth * fraction;
      cached.barFill.setVisible(fraction > 0);
    } else {
      this.updateHealthLabel(cached.sprite, entity.hp, entity.x, entity.y);
    }

    return cached.sprite;
  }

  cleanup(id) {
    const cached = this.spriteCache.get(id);
    cached?.barBg?.destroy();
    cached?.barFill?.destroy();
    super.cleanup(id);
  }
}
