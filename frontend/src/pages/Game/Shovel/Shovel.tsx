import React from 'react';
import { getIconUrl } from '../GameScene/rendering/spriteFrames';

const SHOVEL_ICON_URL = getIconUrl('shovel');

type ShovelProps = {
  active: boolean;
  onToggle: () => void;
};

// Click to arm, then click a planted slot on the board to dig it up. Arming
// the shovel clears any selected plant (and vice versa) — see Game.tsx — so
// the two placement modes can never both be live at once. GameScene fires a
// 'shovel-used' event after a successful swing, which disarms it again.
export default function Shovel({ active, onToggle }: ShovelProps) {
  return (
    <button
      type="button"
      className={`shovel-button ${active ? 'shovel-button--active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label="Shovel — dig up a planted slot for a partial sun refund"
    >
      {SHOVEL_ICON_URL ? (
        <img className="shovel-icon shovel-icon--art" src={SHOVEL_ICON_URL} alt="" draggable={false} />
      ) : (
        <span className="shovel-icon" aria-hidden="true" />
      )}
      <span className="shovel-label">{active ? 'Pick a plant' : 'Shovel'}</span>
    </button>
  );
}
