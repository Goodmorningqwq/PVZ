// Shared slingshot aiming math - used by GameScene.js (to compute the pull
// vector it sends to the server and to snap the drag preview to a target
// slot) and SlingshotRenderer.js (to sample the dotted trajectory preview).
// Every formula here must match backend/src/game/config/slingshotConfig.ts +
// the fireSlingshot/birdHeightAt functions in defaultGameEngine.ts, so the
// preview drawn while dragging always matches what the server will actually
// simulate on release.
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  SLINGSHOT_MAX_PULL,
  SLINGSHOT_MIN_PULL_X,
  SLINGSHOT_RANGE_MULTIPLIER,
  SLINGSHOT_X,
  SLINGSHOT_Y,
  SLINGSHOT_ZMAX_BASE,
  SLINGSHOT_ZMAX_PER_100PX,
  getSlotPositions,
} from './constants';

const SLOT_POSITIONS = getSlotPositions();

// Clamps the raw pointer-minus-anchor vector to the max pull radius,
// preserving direction - mirrors the clamp in fireSlingshot.
export function clampPull(dx, dy) {
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  if (magnitude <= SLINGSHOT_MAX_PULL || magnitude === 0) {
    return { x: dx, y: dy };
  }
  const scale = SLINGSHOT_MAX_PULL / magnitude;
  return { x: dx * scale, y: dy * scale };
}

// A shot only arms once the pull leans far enough to the left (away from the
// fork) - see the comment on fireSlingshot in defaultGameEngine.ts for why.
export function isPullArmed(pull) {
  return -pull.x >= SLINGSHOT_MIN_PULL_X;
}

// Mirrors the (clamped) pull vector through the anchor to get the raw aim
// point, then clamps it to the board bounds. Must match fireSlingshot in
// defaultGameEngine.ts exactly. Relies on the drag capturing the pointer
// (see tryStartSlingshotDrag in GameScene.js) so dragging past the canvas's
// left edge - unavoidable given the anchor sits close to it - still reports
// real (even negative) worldX instead of freezing at the boundary.
export function computeRawTarget(pull) {
  const rawX = SLINGSHOT_X - pull.x * SLINGSHOT_RANGE_MULTIPLIER;
  const rawY = SLINGSHOT_Y - pull.y * SLINGSHOT_RANGE_MULTIPLIER;
  return {
    x: Math.max(0, Math.min(GAME_WIDTH, rawX)),
    y: Math.max(0, Math.min(GAME_HEIGHT, rawY)),
  };
}

// Nearest slot center to a raw aim point - this is the box the shot will
// actually land in.
export function snapToNearestSlot(target) {
  let nearest = SLOT_POSITIONS[0];
  let nearestDistance = Infinity;
  for (const slot of SLOT_POSITIONS) {
    const dx = slot.x - target.x;
    const dy = slot.y - target.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = slot;
    }
  }
  return nearest;
}

// Arc height amplitude for a shot of this distance - farther shots arc
// higher, matching the server's SLINGSHOT_ZMAX_BASE/PER_100PX scaling.
export function computeZMax(distance) {
  return SLINGSHOT_ZMAX_BASE + (distance / 100) * SLINGSHOT_ZMAX_PER_100PX;
}

// Samples `count` points along the fixed-endpoint parabolic lob from the
// anchor to (targetX, targetY), for the dotted trajectory preview. Mirrors
// birdFlightT/birdHeightAt in defaultGameEngine.ts: z is 0 at t=0 and t=1,
// peaking at zMax when t=0.5.
export function sampleTrajectory(targetX, targetY, count) {
  const dx = targetX - SLINGSHOT_X;
  const dy = targetY - SLINGSHOT_Y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const zMax = computeZMax(distance);

  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 1 : index / (count - 1);
    points.push({
      x: SLINGSHOT_X + dx * t,
      y: SLINGSHOT_Y + dy * t,
      z: 4 * zMax * t * (1 - t),
    });
  }
  return points;
}
