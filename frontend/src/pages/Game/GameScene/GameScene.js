import Phaser from 'phaser';
import { emitCollectPlantMatter, emitCollectSun, emitFireSlingshot, emitPlacePlant, emitRemovePlant, getLatestState } from '../../../network';
import gameBackgroundUrl from '../../../assets/gameBackground.png';
import {
  LANE_COLOR,
  LANE_COLOR_ALT,
  PLANT_MATTER_PICKUP_RADIUS,
  SLINGSHOT_GRAB_RADIUS,
  SLOT_MARKER_COLOR,
  SLOT_RADIUS,
  SUN_PICKUP_RADIUS,
} from './constants';
import { getBoardRect, getSlingshotAnchor, getSlots, updateBoardLayout } from './boardLayout';
import { PlantMatterRenderer, PlantRenderer, ProjectileRenderer, SlingshotRenderer, SunRenderer, ZombieRenderer, createPlantAnimations, preloadPlantAnimations } from './rendering';
import { clampPull, computeRawTarget, isPullArmed } from './slingshotMath';
import { normalizeSun, toStringId } from './utils';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.lastRenderedTick = -1;
    this.activePlants = new Map();
    this.activeZombies = new Map();
    this.activeSunPickups = new Map();
    this.latestSunPickups = [];
    // Sun ids already sent to the server via collect_sun this "life" of the
    // pickup — hover fires every update tick while the cursor rests over a
    // sun, so without this guard we'd spam the socket dozens of times a
    // second instead of once. Pruned in renderState() once the pickup is
    // gone (collected or expired).
    this.requestedSunIds = new Set();
    this.activePlantMatterPickups = new Map();
    this.latestPlantMatterPickups = [];
    // Same anti-spam guard as requestedSunIds, for plant matter pickups.
    this.requestedMatterIds = new Set();
    // Set while the player is dragging the slingshot bird; see
    // tryStartSlingshotDrag/updateSlingshotDragFromWorld/handleWindowPointerUp.
    this.slingshotDrag = null;
  }

  preload() {
    this.load.image('gameBackground', gameBackgroundUrl);
    preloadPlantAnimations(this);
  }

  create() {
    createPlantAnimations(this);

    this.plantRenderer = new PlantRenderer(this);
    this.projectileRenderer = new ProjectileRenderer(this);
    this.sunRenderer = new SunRenderer(this);
    this.plantMatterRenderer = new PlantMatterRenderer(this);
    this.zombieRenderer = new ZombieRenderer(this);
    this.slingshotRenderer = new SlingshotRenderer(this);

    this.cameras.main.setBackgroundColor('#2f4a2a');
    this.backgroundImage = this.add.image(0, 0, 'gameBackground').setOrigin(0, 0);
    this.backgroundImage.setDisplaySize(this.scale.width, this.scale.height);
    this.background = this.add.graphics();
    this.slotMarkers = this.add.graphics();

    // Board-dependent visuals (lane shading, slot markers, the fork) can't be
    // drawn here any more: the geometry they need arrives with the first
    // state_update. renderState() draws them once it has, and drawBoardChrome
    // is idempotent so re-running it on a later slot change is safe.
    this.boardChromeDrawn = false;
    this.input.on('pointerdown', this.handlePointerDown, this);
    // Hover collection (desktop/mouse). Tap collection for touch devices —
    // which have no hover concept — is handled in handlePointerDown below.
    this.input.on('pointermove', this.handlePointerMove, this);

    // Slingshot drag continuation/release deliberately does NOT use Phaser's
    // own pointermove/pointerup (see tryStartSlingshotDrag/handleWindowPointerUp):
    // Phaser's MouseManager listens for legacy 'mousemove'/'mouseup' on the
    // canvas element only, so once the real cursor leaves the canvas - which
    // it must, to pull the bird back at all, given the anchor sits close to
    // the board's left edge - the canvas stops receiving them and
    // pointer.worldX/Y just freezes at the boundary. window-level listeners
    // (bound only while a drag is active) get the real, even off-canvas
    // position instead, converted via game.scale.transformX/Y - the same
    // technique Game.tsx's handleMatterDrop already uses for PlantMatterBar's
    // drag-from-outside-the-canvas gesture.
    this.boundHandleWindowPointerMove = this.handleWindowPointerMove.bind(this);
    this.boundHandleWindowPointerUp = this.handleWindowPointerUp.bind(this);
  }

  update() {
    const latestState = getLatestState();

    if (latestState.tick === this.lastRenderedTick) {
      return;
    }

    this.renderState(latestState);
  }

  renderState(latestState) {
    const slots = Array.isArray(latestState?.slots) ? latestState.slots : [];
    const zombies = Array.isArray(latestState?.zombies) ? latestState.zombies : [];
    const tick = Number.isFinite(latestState?.tick) ? latestState.tick : 0;

    this.lastRenderedTick = tick;
    this.latestSlots = slots;

    // Feed the server's geometry into boardLayout before anything reads it —
    // hit-testing, marker drawing and the slingshot all source their
    // coordinates from there now rather than re-deriving them locally.
    updateBoardLayout(latestState);
    if (!this.boardChromeDrawn && getSlots().length > 0) {
      this.drawBackground();
      this.drawSlotMarkers();
      this.boardChromeDrawn = true;
    }
    this.slingshotRenderer.renderFork();
    const projectiles = Array.isArray(latestState?.projectiles) ? latestState.projectiles : [];
    const birdProjectiles = Array.isArray(latestState?.birdProjectiles) ? latestState.birdProjectiles : [];
    const slingshotCooldown = Number.isFinite(latestState?.slingshotCooldown) ? latestState.slingshotCooldown : 0;
    this.latestSlingshotCooldown = slingshotCooldown;
    // Don't fight the pulled-bird visual while a drag is actively in
    // progress - the resting sprite is hidden for the duration anyway (see
    // SlingshotRenderer.updateDrag/renderRestingBird).
    if (!this.slingshotDrag) {
      this.slingshotRenderer.renderRestingBird(slingshotCooldown <= 0, false);
    }
    const sunPickups = Array.isArray(latestState?.sunPickups) ? latestState.sunPickups : [];
    this.latestSunPickups = sunPickups;
    const plantMatterPickups = Array.isArray(latestState?.plantMatterPickups) ? latestState.plantMatterPickups : [];
    this.latestPlantMatterPickups = plantMatterPickups;

    // Drop any "already requested" guard for suns that are no longer in the
    // latest state (collected, expired, or — extremely unlikely — a ~stale
    // request that never landed) so a future spawn can't get permanently
    // stuck unrequestable.
    const livePickupIds = new Set(sunPickups.map((pickup) => pickup.id));
    for (const requestedId of this.requestedSunIds) {
      if (!livePickupIds.has(requestedId)) {
        this.requestedSunIds.delete(requestedId);
      }
    }

    const liveMatterIds = new Set(plantMatterPickups.map((pickup) => pickup.id));
    for (const requestedId of this.requestedMatterIds) {
      if (!liveMatterIds.has(requestedId)) {
        this.requestedMatterIds.delete(requestedId);
      }
    }

    const plantMatterOverflow = latestState?.plantMatterOverflow ?? { over: false, graceTicksRemaining: 0, active: false };
    this.updateOverflowShake(plantMatterOverflow.active);

    this.game.events.emit('hud-update', {
      tick,
      sun: normalizeSun(latestState?.sun),
      plantMatter: Number.isFinite(latestState?.plantMatter) ? latestState.plantMatter : 0,
      plantMatterMax: Number.isFinite(latestState?.plantMatterMax) ? latestState.plantMatterMax : 0,
      plantMatterOverflow,
      plantDefs: latestState?.plantDefs && typeof latestState.plantDefs === 'object' ? latestState.plantDefs : {},
      wave: Number.isFinite(latestState?.wave) ? latestState.wave : 0,
      waveStatus: latestState?.waveStatus || 'pending',
      totalWaves: Number.isFinite(latestState?.totalWaves) ? latestState.totalWaves : 0,
    });

    const plantEntities = slots
      .filter((slot) => slot.plant)
      .map((slot) => ({
        id: `slot-${slot.index}`,
        slotIndex: slot.index,
        x: slot.x,
        y: slot.y,
        type: slot.plant.type,
        hp: slot.plant.hp,
        stamina: slot.plant.stamina,
        staminaMax: slot.plant.staminaMax,
        tired: slot.plant.tired,
        buffed: slot.plant.buffed,
        // Room-wide, so it's stamped onto every plant here rather than sent
        // per-plant on the wire — the renderer only knows about entities.
        overflowed: plantMatterOverflow.active,
      }));

    this.syncSprites(
      this.activePlants,
      plantEntities,
      (entity) => this.plantRenderer.renderPlant(entity),
      (id) => this.plantRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeProjectiles || (this.activeProjectiles = new Map()),
      projectiles,
      (entity) => this.projectileRenderer.renderProjectile(entity, 1),
      (id) => this.projectileRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeBirdProjectiles || (this.activeBirdProjectiles = new Map()),
      birdProjectiles,
      (entity) => this.slingshotRenderer.renderBird(entity),
      (id) => this.slingshotRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeZombies,
      zombies,
      (entity) => this.zombieRenderer.renderZombie(entity, 1),
      (id) => this.zombieRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activeSunPickups,
      sunPickups,
      (entity) => this.sunRenderer.renderSun(entity),
      (id) => this.sunRenderer.cleanup(id),
    );
    this.syncSprites(
      this.activePlantMatterPickups,
      plantMatterPickups,
      (entity) => this.plantMatterRenderer.renderPlantMatter(entity),
      (id) => this.plantMatterRenderer.cleanup(id),
    );
  }

  syncSprites(activeEntities, entities, renderEntity, cleanupEntity) {
    const nextActiveIds = new Set();

    for (const entity of entities) {
      nextActiveIds.add(entity.id);
      renderEntity(entity);
    }

    for (const id of activeEntities.keys()) {
      if (!nextActiveIds.has(id)) {
        cleanupEntity(id);
      }
    }

    activeEntities.clear();
    for (const entity of entities) {
      activeEntities.set(entity.id, entity);
    }
  }

  // Shared by hover (pointermove) and tap (pointerdown, for touch devices
  // with no hover concept) — finds the nearest not-yet-requested sun pickup
  // within range and fires collect_sun for it. Returns true if a sun was
  // targeted, so callers (like handlePointerDown) can skip other tap
  // behavior — e.g. don't also try to place a plant on the same tap.
  tryCollectSunNear(worldX, worldY) {
    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');
    if (!roomId || !playerId) {
      return false;
    }

    const pickup = this.latestSunPickups.find((candidate) => {
      if (this.requestedSunIds.has(candidate.id)) {
        return false;
      }
      const dx = candidate.x - worldX;
      const dy = candidate.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= SUN_PICKUP_RADIUS;
    });

    if (!pickup) {
      return false;
    }

    this.requestedSunIds.add(pickup.id);
    emitCollectSun({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      sunId: pickup.id,
      x: pickup.x,
      y: pickup.y,
    });
    return true;
  }

  // Mirrors tryCollectSunNear exactly, for plant matter pickups.
  tryCollectMatterNear(worldX, worldY) {
    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');
    if (!roomId || !playerId) {
      return false;
    }

    const pickup = this.latestPlantMatterPickups.find((candidate) => {
      if (this.requestedMatterIds.has(candidate.id)) {
        return false;
      }
      const dx = candidate.x - worldX;
      const dy = candidate.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= PLANT_MATTER_PICKUP_RADIUS;
    });

    if (!pickup) {
      return false;
    }

    this.requestedMatterIds.add(pickup.id);
    emitCollectPlantMatter({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      matterId: pickup.id,
      x: pickup.x,
      y: pickup.y,
    });
    return true;
  }

  // Grabs the resting bird if the pointer went down within range of it and
  // the slingshot is off cooldown. Takes priority over every other
  // pointerdown behavior (sun/matter collection, shovel, plant placement) -
  // it's a deliberate, spatially-isolated gesture on the far left edge where
  // nothing else lives. Returns true if a drag was started.
  tryStartSlingshotDrag(pointer) {
    if (this.slingshotDrag || (this.latestSlingshotCooldown ?? 0) > 0) {
      return false;
    }

    const anchor = getSlingshotAnchor();
    if (!anchor) {
      return false;
    }

    const dx = pointer.worldX - anchor.x;
    const dy = pointer.worldY - anchor.y;
    if (Math.sqrt(dx * dx + dy * dy) > SLINGSHOT_GRAB_RADIUS) {
      return false;
    }

    this.slingshotDrag = { pull: { x: 0, y: 0 } };
    this.updateSlingshotDragFromWorld(pointer.worldX, pointer.worldY);
    // See the comment above these listeners' declaration in create() - Phaser
    // itself can't track this drag once it leaves the canvas.
    window.addEventListener('pointermove', this.boundHandleWindowPointerMove);
    window.addEventListener('pointerup', this.boundHandleWindowPointerUp);
    return true;
  }

  // Redraws the pulled-back bird, rubber band, trajectory preview, and
  // target-slot highlight for the current world position. The pull vector
  // computed here (clamped, mirrored, snapped to a slot via slingshotMath.js)
  // is exactly what handleWindowPointerUp sends to the server on release, so
  // the preview never lies about where the shot will land.
  updateSlingshotDragFromWorld(worldX, worldY) {
    const anchor = getSlingshotAnchor();
    if (!anchor) {
      return;
    }

    const pull = clampPull(worldX - anchor.x, worldY - anchor.y);
    const armed = isPullArmed(pull);
    const target = computeRawTarget(pull);

    this.slingshotDrag.pull = pull;
    this.slingshotRenderer.updateDrag(anchor.x + pull.x, anchor.y + pull.y, target, armed);
  }

  handleWindowPointerMove(event) {
    if (!this.slingshotDrag) {
      return;
    }
    const worldX = this.scale.transformX(event.pageX);
    const worldY = this.scale.transformY(event.pageY);
    this.updateSlingshotDragFromWorld(worldX, worldY);
  }

  handleWindowPointerUp() {
    if (!this.slingshotDrag) {
      return;
    }

    window.removeEventListener('pointermove', this.boundHandleWindowPointerMove);
    window.removeEventListener('pointerup', this.boundHandleWindowPointerUp);

    const { pull } = this.slingshotDrag;
    const armed = isPullArmed(pull);
    this.slingshotDrag = null;
    this.slingshotRenderer.clearDrag();
    // Optimistically show "reloading" immediately on a fired shot rather
    // than waiting ~50ms for the next state_update to confirm the cooldown
    // - avoids a one-frame flash of the bird looking grabbable again.
    this.slingshotRenderer.renderRestingBird(!armed, false);

    if (!armed) {
      return;
    }

    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');
    if (!roomId || !playerId) {
      return;
    }

    emitFireSlingshot({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      dx: pull.x,
      dy: pull.y,
    });
  }

  handlePointerMove(pointer) {
    // Slingshot drags are tracked via window-level listeners instead (see
    // tryStartSlingshotDrag) - while one is active, skip hover collection so
    // it doesn't fire for whatever the pulled-back pointer happens to cross.
    if (this.slingshotDrag) {
      return;
    }

    this.tryCollectSunNear(pointer.worldX, pointer.worldY);
    this.tryCollectMatterNear(pointer.worldX, pointer.worldY);
  }

  handlePointerDown(pointer) {
    if (this.tryStartSlingshotDrag(pointer)) {
      return;
    }

    // Tap-to-collect for touch devices (no hover event ever fires there).
    // On desktop this is usually a no-op since hover already requested the
    // pickup the moment the cursor entered range, but it's a harmless second
    // check either way thanks to the requested*Ids guards. Sun and plant
    // matter are independent pickups that can coexist at different board
    // positions, so both are checked (not else-if) before falling through
    // to plant placement.
    const collectedSun = this.tryCollectSunNear(pointer.worldX, pointer.worldY);
    const collectedMatter = this.tryCollectMatterNear(pointer.worldX, pointer.worldY);
    if (collectedSun || collectedMatter) {
      return;
    }

    // Shovel and plant selection are mutually exclusive (Game.tsx clears one
    // when the other is picked), so this can't collide with placement below.
    const shovelActive = Boolean(this.registry.get('shovelActive'));
    const selectedPlant = this.registry.get('selectedPlant');
    if (!shovelActive && !selectedPlant) {
      return;
    }

    const slot = getSlots().find((candidate) => {
      const dx = candidate.x - pointer.worldX;
      const dy = candidate.y - pointer.worldY;
      return Math.sqrt(dx * dx + dy * dy) <= SLOT_RADIUS;
    });

    if (!slot) {
      return;
    }

    const roomId = this.registry.get('roomId');
    const playerId = this.registry.get('playerId');
    if (!roomId || !playerId) {
      return;
    }

    const occupied = (this.latestSlots || []).some((s) => s.index === slot.index && s.plant);

    if (shovelActive) {
      // Clicking bare ground with the shovel out is a deliberate no-op rather
      // than a rejection — there's nothing there to explain.
      if (!occupied) {
        return;
      }

      emitRemovePlant({
        roomId: toStringId(roomId),
        playerId: toStringId(playerId),
        slotIndex: slot.index,
      });
      // One swing per selection, matching classic PvZ: the shovel deactivates
      // after use so a stray second click can't dig up a neighbouring plant.
      this.game.events.emit('shovel-used');
      return;
    }

    if (occupied) {
      return;
    }

    emitPlacePlant({
      roomId: toStringId(roomId),
      playerId: toStringId(playerId),
      plant: selectedPlant,
      slotIndex: slot.index,
    });
  }

  // Sustained camera shake while the plant matter overflow penalty is live,
  // paired with the centred alert Game.tsx renders. Phaser's shake takes a
  // fixed duration, so this re-arms it whenever it lapses rather than firing
  // one long shake — that keeps it running indefinitely while still stopping
  // immediately the moment the pool drops back under the cap.
  //
  // Intensity is deliberately low. This runs continuously until the player
  // reacts, so it has to read as "something is wrong" without becoming
  // unpleasant to look at.
  updateOverflowShake(active) {
    const camera = this.cameras?.main;
    if (!camera) {
      return;
    }

    if (!active) {
      if (camera.shakeEffect?.isRunning) {
        camera.shakeEffect.reset();
      }
      return;
    }

    // Honour the OS-level reduced-motion setting: the alert still shows, but
    // a continuous shake is exactly the kind of motion that preference exists
    // to suppress.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return;
    }

    if (!camera.shakeEffect?.isRunning) {
      camera.shake(700, 0.004);
    }
  }

  drawSlotMarkers() {
    // Styled like the app's input/dashed-box treatment (.menu-pin-input,
    // .waiting-code) rather than a bare thin outline, so open slots read as
    // "placeholder cards" consistent with the rest of the UI.
    this.slotMarkers.clear();
    for (const slot of getSlots()) {
      this.slotMarkers.fillStyle(0xffffff, 0.14);
      this.slotMarkers.fillCircle(slot.x, slot.y, SLOT_RADIUS);
      this.slotMarkers.lineStyle(2, SLOT_MARKER_COLOR, 0.55);
      this.slotMarkers.strokeCircle(slot.x, slot.y, SLOT_RADIUS);
    }
  }

  drawBackground() {
    const { height } = this.scale;
    const rect = getBoardRect();

    this.background.clear();
    if (!rect) {
      return;
    }

    // Checkerboard lane shading, alternating so each zombie lane reads
    // clearly. Drawn with partial alpha over gameBackground so the lawn art
    // still shows through. The rows and their extent come from the server's
    // slot positions (via getBoardRect) rather than from local margin
    // constants, so if the grid is ever inset to the background's actual lawn
    // area this shading follows it automatically.
    const laneWidth = Math.max(rect.right - rect.left, 0);
    rect.laneYs.forEach((laneY, laneIndex) => {
      const rowTop = Math.max(0, laneY - rect.rowHeight / 2);
      const rowBottom = Math.min(height, laneY + rect.rowHeight / 2);
      this.background.fillStyle(laneIndex % 2 === 0 ? LANE_COLOR : LANE_COLOR_ALT, 0.35);
      this.background.fillRect(rect.left, rowTop, laneWidth, Math.max(rowBottom - rowTop, 0));
    });
  }
}
