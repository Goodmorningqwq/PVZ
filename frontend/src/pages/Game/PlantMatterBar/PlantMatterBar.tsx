import React, { useRef, useState } from 'react';
import plantMatterIcon from '../../../assets/sprites/plantmatter/idle/frame-0.svg';

type PlantMatterBarProps = {
  plantMatter: number;
  // Game.tsx owns the Phaser instance and the latest slot state, so it's the
  // one that knows how to turn a raw client x/y into a world coordinate and
  // find the nearest plant - this component only owns the drag gesture UI.
  onDrop: (clientX: number, clientY: number) => void;
};

// Bar fill is purely cosmetic - the pool is intentionally uncapped (see
// gameConfig.ts / the brainstorm that led here: a hard cap on the shared
// pool felt pointless once repair/buff sinks existed), so this is just a
// "how full does the bar look" reference point, not a real ceiling. The
// numeric readout below the bar always shows the real value.
const BAR_VISUAL_MAX = 400;

export default function PlantMatterBar({ plantMatter, onDrop }: PlantMatterBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const activePointerId = useRef<number | null>(null);

  const fillPercent = Math.max(0, Math.min(100, (plantMatter / BAR_VISUAL_MAX) * 100));

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
      onDrop(event.clientX, event.clientY);
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
    <div className="plant-matter-bar">
      <div className="plant-matter-bar-track" aria-hidden="true">
        <div className="plant-matter-bar-fill" style={{ height: `${fillPercent}%` }} />
      </div>
      <div className="plant-matter-bar-value">{plantMatter}</div>
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
