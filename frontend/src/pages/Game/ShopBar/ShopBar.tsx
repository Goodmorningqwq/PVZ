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

export default function ShopBar({ ownSun, selectedPlant, onSelectPlant, plantDefs }: ShopBarProps) {
  const plantTypes = Object.keys(plantDefs);

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
            <span className="shop-card-name">{def.label}</span>
            <span className="shop-card-cost">{def.cost} sun</span>
          </button>
        );
      })}
    </div>
  );
}
