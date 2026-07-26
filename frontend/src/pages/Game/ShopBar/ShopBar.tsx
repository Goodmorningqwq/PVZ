import React from 'react';

type PlantDef = {
  cost: number;
  label: string;
};

type ShopBarProps = {
  ownSun: number;
  selectedPlant: string | null;
  onSelectPlant: (plantType: string) => void;
  plantDefs: Record<string, PlantDef>;
};

// The seed bar keeps a fixed number of cells so it doesn't visibly resize as
// plant types are added — unfilled cells render as inert placeholders. Bump
// this as new plants land; anything beyond the number of real plants shows as
// an empty slot.
const SEED_SLOT_COUNT = 5;

export default function ShopBar({ ownSun, selectedPlant, onSelectPlant, plantDefs }: ShopBarProps) {
  const plantTypes = Object.keys(plantDefs);
  const placeholderCount = Math.max(0, SEED_SLOT_COUNT - plantTypes.length);

  return (
    <div className="shop-bar">
      {plantTypes.map((plantType) => {
        const def = plantDefs[plantType];
        const affordable = ownSun >= def.cost;
        const isSelected = selectedPlant === plantType;

        return (
          <button
            key={plantType}
            type="button"
            className={`shop-card ${isSelected ? 'shop-card--selected' : ''} ${!affordable ? 'shop-card--disabled' : ''}`}
            disabled={!affordable}
            onClick={() => onSelectPlant(plantType)}
          >
            <span className={`shop-card-icon shop-card-icon--${plantType}`} aria-hidden="true" />
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
