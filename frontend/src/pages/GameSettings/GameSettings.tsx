import React, { useState } from 'react';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export function generateRoomCode(length = 5) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Fewer zombies, slower pace' },
  { value: 'medium', label: 'Medium', description: 'Balanced challenge' },
  { value: 'hard', label: 'Hard', description: 'More zombies, faster runners' },
];

type GameSettingsProps = {
  mode: 'multiplayer' | 'singleplayer';
  onBack: () => void;
  onStartSolo: (difficulty: Difficulty) => void;
  onStartMultiplayer: (roomId: string, difficulty: Difficulty) => void;
};

export default function GameSettings({ mode, onBack, onStartSolo, onStartMultiplayer }: GameSettingsProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [codeInput, setCodeInput] = useState('');

  function handleJoinSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    onStartMultiplayer(trimmed, difficulty);
  }

  function handleCreateRoom() {
    onStartMultiplayer(generateRoomCode(), difficulty);
  }

  return (
    <div className="menu-backdrop">
      <div className="menu-card">
        <h1 className="menu-title">Game Settings</h1>
        <p className="menu-subtitle">{mode === 'multiplayer' ? 'Multiplayer' : 'Singleplayer'}</p>

        <div className="difficulty-grid">
          {DIFFICULTY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`difficulty-option${difficulty === option.value ? ' difficulty-option--selected' : ''}`}
              onClick={() => setDifficulty(option.value)}
            >
              <span className="difficulty-option-label">{option.label}</span>
              <span className="difficulty-option-description">{option.description}</span>
            </button>
          ))}
        </div>

        {mode === 'singleplayer' ? (
          <button className="menu-primary-button" type="button" onClick={() => onStartSolo(difficulty)}>
            Start
          </button>
        ) : (
          <>
            <form className="menu-form" onSubmit={handleJoinSubmit}>
              <input
                className="menu-pin-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={8}
                placeholder="Room Code"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
              />
              <button className="menu-primary-button" type="submit" disabled={!codeInput.trim()}>
                Join
              </button>
            </form>

            <div className="menu-divider">
              <span>or</span>
            </div>

            <button className="menu-secondary-button" type="button" onClick={handleCreateRoom}>
              Create New Room
            </button>
          </>
        )}

        <button className="menu-link-button" type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
