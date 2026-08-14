import React, { useRef, useState } from 'react';
import plantMatterIcon from '../../../assets/sprites/ItemTextures/plantmatter/idle/frame-0.svg';

type PlantMatterOverflow = {
  over: boolean;
  graceTicksRemaining: number;
  active: boolean;
};

type PlantMatterBarProps = {
  plantMatter: number;
  // Soft cap from the server. Matter still accumulates past it; going over
  // starts a grace countdown and then slows every plant.
  plantMatterMax: number;
  overflow: PlantMatterOverflow;
  // Game.tsx owns the Phaser instance and the latest slot state, so it's the
  // one that knows how to turn a page coordinate into a world coordinate and
  // find the nearest plant - this component only owns the drag gesture UI.
  // Deliberately pageX/pageY (not clientX/clientY): Phaser's
  // ScaleManager.transformX/Y expect page-relative coordinates.
  onDrop: (pageX: number, pageY: number) => void;
};

// Fallback only, for the brief window before the first state_update arrives.
// The real cap is PLANT_MATTER_SOFT_MAX on the server and comes in on every
// state update — this used to be a purely cosmetic "how full does the bar
// look" number because the pool was genuinely uncapped, but overflow now has
// real consequences so the bar has to draw against the actual threshold.
const FALLBACK_BAR_MAX = 400;

// Server ticks per second — used only to render the grace countdown as
// seconds. Must match TICK_RATE in the backend's gameConfig.ts.
const TICK_RATE = 20;

export default function PlantMatterBar({ plantMatter, plantMatterMax, overflow, onDrop }: PlantMatterBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const activePointerId = useRef<number | null>(null);

  const barMax = plantMatterMax > 0 ? plantMatterMax : FALLBACK_BAR_MAX;
  const fillPercent = Math.max(0, Math.min(100, (plantMatter / barMax) * 100));
  const graceSeconds = Math.ceil(overflow.graceTicksRemaining / TICK_RATE);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    setIsDragging(true);
    setGhostPos({ x: event.clientX, y: event.clientY });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== event.pointerId) {
      return;
    }
    setGhostPos({ x: event.clientX, y: event.clientY });
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>, shouldDrop: boolean) {
    if (activePointerId.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activePointerId.current = null;
    setIsDragging(false);
    setGhostPos(null);

    if (shouldDrop) {
      onDrop(event.pageX, event.pageY);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    endDrag(event, true);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    // Cancel (e.g. the browser deciding this is a scroll gesture instead)
    // means no drop should fire - the handle just snaps back.
    endDrag(event, false);
  }

  return (
    <div className={`plant-matter-bar ${overflow.active ? 'plant-matter-bar--overflowing' : ''}`}>
      <div className="plant-matter-bar-track" aria-hidden="true">
        <div
          className={`plant-matter-bar-fill ${overflow.over ? 'plant-matter-bar-fill--over' : ''}`}
          style={{ height: `${fillPercent}%` }}
        />
      </div>
      <div className="plant-matter-bar-value">
        {plantMatter}
        <span className="plant-matter-bar-max">/{barMax}</span>
      </div>

      {/* Two distinct states: still inside the grace period (a countdown you
          can act on) versus the penalty actually biting. */}
      {overflow.over && !overflow.active && (
        <div className="plant-matter-warning" role="status">
          Over capacity — spend within {graceSeconds}s
        </div>
      )}
      {overflow.active && (
        <div className="plant-matter-warning plant-matter-warning--active" role="status">
          Overloaded — plants slowed
        </div>
      )}
      <div
        className={`plant-matter-handle ${isDragging ? 'plant-matter-handle--dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        role="button"
        tabIndex={0}
        aria-label="Drag onto a plant to repair or buff it with plant matter"
      >
        <img src={plantMatterIcon} alt="" draggable={false} />
      </div>

      {isDragging && ghostPos && (
        <img
          src={plantMatterIcon}
          alt=""
          draggable={false}
          className="plant-matter-drag-ghost"
          style={{ left: ghostPos.x, top: ghostPos.y }}
        />
      )}
    </div>
  );
}
