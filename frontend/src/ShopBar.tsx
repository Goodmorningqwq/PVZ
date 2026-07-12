import React from 'react';
import { PLANT_STATS } from './scenes/GameScene/constants';

type ShopBarProps = {
  ownSun: number;
  selectedPlant: string | null;
  onSelectPlant: (plantType: string) => void;
};

const PLANT_TYPES = Object.keys(PLANT_STATS) as Array<keyof typeof PLANT_STATS>;

export default function ShopBar({ ownSun, selectedPlant, onSelectPlant }: ShopBarProps) {
  return (
    <div className="shop-bar">
      {PLANT_TYPES.map((plantType) => {
        const def = PLANT_STATS[plantType];
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
