import {
  BIRD_COLOR,
  BIRD_RADIUS,
  SLINGSHOT_X,
  SLINGSHOT_Y,
  SLINGSHOT_BAND_COLOR,
  TRAJECTORY_DOT_COLOR,
  TRAJECTORY_DOT_COUNT,
} from '../constants';
import { sampleTrajectory, snapToNearestSlot } from '../slingshotMath';
import { BaseRenderer } from './BaseRenderer';

// Height (z) is a purely cosmetic third axis - it's not a board coordinate,
// just how far "up" the bird is. Selling it on a flat 2D canvas is the
// classic pair of tricks: shift the sprite up on screen and shrink/scale it,
// and shrink a ground shadow drawn at the true (unshifted) x/y - the higher
// the bird, the smaller/fainter its shadow gets.
const HEIGHT_TO_SCREEN_OFFSET = 0.8;
const HEIGHT_TO_SCALE = 0.008;
const MAX_SCALE_HEIGHT = 80; // clamp so very long shots don't balloon the sprite

function heightScreenOffset(z) {
  return z * HEIGHT_TO_SCREEN_OFFSET;
}

function heightScale(z) {
  return 1 + Math.min(z, MAX_SCALE_HEIGHT) * HEIGHT_TO_SCALE;
}

export class SlingshotRenderer extends BaseRenderer {
  constructor(scene) {
    super(scene);
    this.forkImage = null;
    this.restBird = null;
    this.dragGraphics = scene.add.graphics().setDepth(5);
    this.pulledBird = null;
  }

  // Static fork fixture at the anchor. Uses the slingshot-idle-0 texture
  // auto-preloaded by preloadPlantAnimations (see spriteFrames.js's glob -
  // any assets/sprites/*/*/*/* folder gets picked up, "slingshot" doesn't
  // need to be a real plant).
  renderFork() {
    if (this.forkImage) {
      return;
    }
    if (this.scene.textures.exists('slingshot-idle-0')) {
      this.forkImage = this.scene.add.image(SLINGSHOT_X, SLINGSHOT_Y, 'slingshot-idle-0').setOrigin(0.4, 0.5);
    }
  }

  // The bird sitting in the pouch, ready to be grabbed - dimmed while the
  // slingshot is on cooldown so it reads as "not ready yet". Hidden entirely
  // while a drag is in progress (updateDrag draws the pulled bird instead).
  renderRestingBird(ready, dragging) {
    if (!this.restBird) {
      this.restBird = this.scene.add.circle(SLINGSHOT_X, SLINGSHOT_Y, BIRD_RADIUS, BIRD_COLOR).setStrokeStyle(2, 0x1a3f9e);
    }
    this.restBird.setVisible(!dragging);
    this.restBird.setAlpha(ready ? 1 : 0.35);
  }

  // Called continuously while the player drags: draws the stretched band,
  // the pulled-back bird, the dotted trajectory preview, and a highlight on
  // whichever slot the shot is currently aimed at. `armed` is whether the
  // pull currently clears the minimum threshold to actually fire.
  updateDrag(pointerX, pointerY, target, armed) {
    if (!this.pulledBird) {
      this.pulledBird = this.scene.add.circle(SLINGSHOT_X, SLINGSHOT_Y, BIRD_RADIUS, BIRD_COLOR).setStrokeStyle(2, 0x1a3f9e);
    }
    this.pulledBird.setVisible(true);
    this.pulledBird.setPosition(pointerX, pointerY);
    this.pulledBird.setAlpha(armed ? 1 : 0.6);

    this.dragGraphics.clear();

    // Rubber band from the two fork prongs to the pulled bird.
    this.dragGraphics.lineStyle(3, SLINGSHOT_BAND_COLOR, 0.9);
    this.dragGraphics.lineBetween(SLINGSHOT_X + 20, SLINGSHOT_Y - 26, pointerX, pointerY);
    this.dragGraphics.lineBetween(SLINGSHOT_X + 20, SLINGSHOT_Y + 26, pointerX, pointerY);

    if (!armed) {
      return;
    }

    const slot = snapToNearestSlot(target);

    // Target slot highlight - a pulsing-looking double ring is overkill for a
    // per-frame redraw, so just two concentric strokes.
    this.dragGraphics.lineStyle(2, 0xffffff, 0.85);
    this.dragGraphics.strokeCircle(slot.x, slot.y, 30);
    this.dragGraphics.lineStyle(2, BIRD_COLOR, 0.5);
    this.dragGraphics.strokeCircle(slot.x, slot.y, 24);

    // Dotted arc preview, sampled from the exact same parabola the server
    // will simulate on release (see slingshotMath.js).
    const points = sampleTrajectory(slot.x, slot.y, TRAJECTORY_DOT_COUNT);
    this.dragGraphics.fillStyle(TRAJECTORY_DOT_COLOR, 0.8);
    for (const point of points) {
      this.dragGraphics.fillCircle(point.x, point.y - heightScreenOffset(point.z), 3);
    }
  }

  // Called on release (fired or cancelled) to clear all drag-only visuals.
  clearDrag() {
    this.pulledBird?.setVisible(false);
    this.dragGraphics.clear();
  }

  // In-flight bird, synced from server state via GameScene's syncSprites -
  // same shape as ProjectileRenderer/ZombieRenderer. entity.z drives the
  // height illusion: screen position shifts up and the sprite scales up
  // slightly as z grows, with a shadow left behind on the ground plane.
  renderBird(entity) {
    const id = String(entity?.id ?? '');
    if (!id) {
      return null;
    }

    let cached = this.spriteCache.get(id);
    if (!cached) {
      const shadow = this.scene.add.ellipse(entity.x, entity.y, BIRD_RADIUS * 2.6, BIRD_RADIUS * 1.1, 0x000000, 0.28);
      const sprite = this.scene.add.circle(0, 0, BIRD_RADIUS, BIRD_COLOR).setStrokeStyle(2, 0x1a3f9e);
      cached = { sprite, shadow };
      this.spriteCache.set(id, cached);
    }

    const z = Number.isFinite(entity.z) ? entity.z : 0;
    cached.shadow.setPosition(entity.x, entity.y);
    const shadowFactor = Math.max(0.3, 1 - Math.min(z, 70) / 90);
    cached.shadow.setScale(shadowFactor);

    cached.sprite.setPosition(entity.x, entity.y - heightScreenOffset(z));
    cached.sprite.setScale(heightScale(z));

    return cached.sprite;
  }

  cleanup(id) {
    const cached = this.spriteCache.get(id);
    cached?.shadow?.destroy();
    super.cleanup(id);
  }
}
