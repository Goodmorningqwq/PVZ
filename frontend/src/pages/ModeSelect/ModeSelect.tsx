import React from 'react';

type GameMode = 'multiplayer' | 'singleplayer';

type ModeSelectProps = {
  onSelectMode: (mode: GameMode) => void;
  onPlayDemo: () => void;
};

export default function ModeSelect({ onSelectMode, onPlayDemo }: ModeSelectProps) {
  return (
    <div className="menu-backdrop">
      <div className="menu-card">
        <h1 className="menu-title">Plants vs Zombies</h1>
        <p className="menu-subtitle">Choose how you want to play</p>

        <button className="menu-secondary-button" type="button" onClick={() => onSelectMode('multiplayer')}>
          Multiplayer
        </button>

        <button className="menu-secondary-button" type="button" onClick={() => onSelectMode('singleplayer')}>
          Singleplayer
        </button>

        <button className="menu-link-button" type="button" onClick={onPlayDemo}>
          Try the demo (no setup needed)
        </button>
      </div>
    </div>
  );
}
