import React from 'react';
import { getIconUrl } from '../GameScene/rendering/spriteFrames';

type PlantDef = {
  cost: number;
  label: string;
};

type ShopBarProps = {
  ownSun: number;
  selectedPlant: string | null;
  onSelectPlant: (plantType: string) => void;
  plantDefs: Record<string, PlantDef>;
  // Plant types this player may place. `null` means the server didn't say, in
  // which case nothing is treated as locked — the authoritative check lives in
  // placePlant on the server, so a client with incomplete information must
  // fail open here rather than locking someone out of their own game.
  //
  // Locked plants are shown rather than hidden: an unearned plant you can see
  // is a goal, one that's absent is invisible.
  unlockedPlants?: string[] | null;
};

// The seed bar keeps a fixed number of cells so it doesn't visibly resize as
// plant types are added — unfilled cells render as inert placeholders. Bump
// this as new plants land; anything beyond the number of real plants shows as
// an empty slot.
const SEED_SLOT_COUNT = 5;

export default function ShopBar({
  ownSun, selectedPlant, onSelectPlant, plantDefs, unlockedPlants = null,
}: ShopBarProps) {
  const plantTypes = Object.keys(plantDefs);
  const placeholderCount = Math.max(0, SEED_SLOT_COUNT - plantTypes.length);

  return (
    <div className="shop-bar">
      {plantTypes.map((plantType) => {
        const def = plantDefs[plantType];
        const locked = unlockedPlants !== null && !unlockedPlants.includes(plantType);
        const affordable = ownSun >= def.cost;
        const isSelected = selectedPlant === plantType;
        // Real sprite art, falling back to the old flat colour swatch only if
        // a plant type ever ships without frames.
        const iconUrl = getIconUrl(plantType);

        return (
          <button
            key={plantType}
            type="button"
            className={`shop-card ${isSelected ? 'shop-card--selected' : ''} ${!affordable && !locked ? 'shop-card--disabled' : ''} ${locked ? 'shop-card--locked' : ''}`}
            disabled={locked || !affordable}
            onClick={() => onSelectPlant(plantType)}
            title={locked ? `${def.label} — not unlocked yet` : undefined}
          >
            {iconUrl ? (
              <img className="shop-card-icon shop-card-icon--art" src={iconUrl} alt="" draggable={false} />
            ) : (
              <span className={`shop-card-icon shop-card-icon--${plantType}`} aria-hidden="true" />
            )}
            <span className="shop-card-info">
              <span className="shop-card-name">{def.label}</span>
              <span className="shop-card-cost">{def.cost} sun</span>
            </span>
          </button>
        );
      })}

      {Array.from({ length: placeholderCount }, (_, index) => (
        <div className="shop-card shop-card--empty" key={`empty-${index}`} aria-hidden="true">
          <span className="shop-card-empty-mark" />
        </div>
      ))}
    </div>
  );
}
