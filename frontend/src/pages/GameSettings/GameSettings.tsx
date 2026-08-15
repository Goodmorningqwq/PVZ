import React, { useRef, useState } from 'react';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(length = ROOM_CODE_LENGTH) {
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
  // Owned by App so it survives Back and re-entry. This screen used to keep
  // its own copy alongside App's, which meant Settings -> Back -> Settings
  // silently reset the picker to Medium regardless of what was actually set.
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
};

export default function GameSettings({
  mode, onBack, onStartSolo, onStartMultiplayer, difficulty, onDifficultyChange,
}: GameSettingsProps) {
  const [codeInput, setCodeInput] = useState('');
  // Guards against a double-click generating two different codes and racing
  // them — handleCreateRoom rolls a fresh one on every call, and the second
  // used to win.
  const startedRef = useRef(false);

  function handleJoinSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = codeInput.trim();
    if (!trimmed || startedRef.current) {
      return;
    }
    startedRef.current = true;
    onStartMultiplayer(trimmed, difficulty);
  }

  function handleCreateRoom() {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
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
              onClick={() => onDifficultyChange(option.value)}
              aria-pressed={difficulty === option.value}
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
                maxLength={ROOM_CODE_LENGTH}
                placeholder="Room Code"
                value={codeInput}
                // Uppercase at the source, not at submit. The field only
                // *looked* uppercase via CSS text-transform, so state held
                // whatever was typed and anything reading codeInput directly
                // got the lowercase string.
                onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                autoFocus
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
