export class BaseRenderer {
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
