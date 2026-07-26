import React from 'react';
import { getIconUrl } from '../GameScene/rendering/spriteFrames';

const SUN_ICON_URL = getIconUrl('sun');

type SunMeterProps = {
  playerId: string;
  sun: Record<string, number>;
};

// P1/P2 are assigned by join order, not by who is looking: both players see
// the same label against the same person, which is what makes the labels worth
// saying out loud ("P2, put a wall-nut in lane 3"). `sun` is serialized from
// room.sun, whose keys are inserted by initializePlayerSun as each player
// joins, so Object.keys order is join order. Your own row gets a "you" tag
// rather than being relabelled, so the shared vocabulary stays intact.
//
// Wave/status and the mode badge used to live here; they moved to the app
// header when this became a pure sun panel (see Game.tsx).
export default function SunMeter({ playerId, sun }: SunMeterProps) {
  const entries = Object.entries(sun);

  if (entries.length === 0) {
    return (
      <div className="sun-panel">
        <span className="sun-panel-empty">No sun data yet</span>
      </div>
    );
  }

  return (
    <div className="sun-panel">
      {entries.map(([id, value], index) => (
        <div className={`sun-row ${id === playerId ? 'sun-row--self' : ''}`} key={id}>
          {SUN_ICON_URL ? (
            <img className="sun-row-icon sun-row-icon--art" src={SUN_ICON_URL} alt="" draggable={false} />
          ) : (
            <span className="sun-row-icon" aria-hidden="true" />
          )}
          <span className="sun-row-body">
            <span className="sun-row-label">
              P{index + 1}
              {id === playerId && <span className="sun-row-you">you</span>}
            </span>
            <span className="sun-row-value">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
