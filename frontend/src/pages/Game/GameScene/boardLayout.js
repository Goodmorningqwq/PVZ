// The client's view of board geometry — read from server state, never
// computed.
//
// This module exists to make one rule enforceable: the frontend holds no
// opinion about where anything on the board is. Previously constants.js
// re-implemented the server's lane-Y and slot-X formulas so it could hit-test
// clicks, draw slot markers and snap slingshot shots. Those copies agreed with
// the server only because someone kept them in sync by hand, and nothing
// failed when they drifted — a mismatch just meant clicks landing on different
// tiles than plants rendered on, or an aiming preview that lied.
//
// Every state_update already carries each slot's index/laneIndex/x/y plus the
// slingshot anchor, so all of it can simply be read. Callers must tolerate
// empty results before the first state arrives.

let slots = [];
let slingshotAnchor = null;

export function updateBoardLayout(state) {
  if (Array.isArray(state?.slots) && state.slots.length > 0) {
    slots = state.slots;
  }

  const anchor = state?.slingshot;
  if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
    slingshotAnchor = anchor;
  }
}

export function getSlots() {
  return slots;
}

// Null until the first state_update. Callers gate interaction on it rather
// than falling back to a hardcoded anchor, so a desync can't hide behind a
// stale default.
export function getSlingshotAnchor() {
  return slingshotAnchor;
}

// Distinct lane centre Ys, ascending — one per row.
export function getLaneYs() {
  return [...new Set(slots.map((slot) => slot.y))].sort((a, b) => a - b);
}

// The playfield rectangle implied by the slot centres, reconstructed by
// extending half a cell past the outermost centres in each direction. With the
// server's current full-canvas layout this reproduces the old
// SLOT_MARGIN-inset rect exactly; if the grid is ever inset to a background's
// lawn area, this follows it with no client change.
export function getBoardRect() {
  if (slots.length === 0) {
    return null;
  }

  const xs = slots.map((slot) => slot.x);
  const laneYs = getLaneYs();
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const columnCount = new Set(xs).size;
  const cellWidth = columnCount > 1 ? (maxX - minX) / (columnCount - 1) : 0;
  const rowHeight = laneYs.length > 1 ? (laneYs[laneYs.length - 1] - laneYs[0]) / (laneYs.length - 1) : 0;

  return {
    left: minX - cellWidth / 2,
    right: maxX + cellWidth / 2,
    top: laneYs[0] - rowHeight / 2,
    bottom: laneYs[laneYs.length - 1] + rowHeight / 2,
    cellWidth,
    rowHeight,
    laneYs,
  };
}
