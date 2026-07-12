import React, { useState } from 'react';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export function generateRoomCode(length = 5) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

type RoomMenuProps = {
  onJoin: (roomId: string) => void;
  onPlayDemo: () => void;
};

export default function RoomMenu({ onJoin, onPlayDemo }: RoomMenuProps) {
  const [codeInput, setCodeInput] = useState('');

  function handleJoinSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    onJoin(trimmed);
  }

  function handleCreateRoom() {
    onJoin(generateRoomCode());
  }

  return (
    <div className="menu-backdrop">
      <div className="menu-card">
        <h1 className="menu-title">Plants vs Zombies</h1>
        <p className="menu-subtitle">Multiplayer</p>

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

        <button className="menu-link-button" type="button" onClick={onPlayDemo}>
          Try the demo (no opponent needed)
        </button>
      </div>
    </div>
  );
}
