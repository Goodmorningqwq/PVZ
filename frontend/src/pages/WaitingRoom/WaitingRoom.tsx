import React, { useState } from 'react';

type WaitingRoomProps = {
  roomId: string;
  statusText: string;
  isDemo?: boolean;
  isSolo?: boolean;
  players?: string[];
  capacity?: number;
  canStart?: boolean;
  onStartGame?: () => void;
};

export default function WaitingRoom({
  roomId,
  statusText,
  isDemo,
  isSolo,
  players = [],
  capacity = 2,
  canStart = false,
  onStartGame,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the code is
      // still visible on screen for manual sharing.
    }
  }

  return (
    <div className="menu-backdrop waiting-room-backdrop">
      <div className="menu-card">
        {isDemo ? (
          <>
            <h1 className="menu-title">Loading demo...</h1>
            <p className="menu-subtitle">Setting up your sandbox</p>
          </>
        ) : isSolo ? (
          <>
            <h1 className="menu-title">Loading solo game...</h1>
            <p className="menu-subtitle">Setting up your lawn</p>
          </>
        ) : (
          <>
            <h1 className="menu-title">{canStart ? 'Room is full' : 'Waiting for opponent'}</h1>
            <p className="menu-subtitle">{canStart ? 'Anyone can start the match' : 'Share this code to start'}</p>

            <div className="waiting-code">{roomId}</div>

            {canStart ? (
              <button className="menu-primary-button" type="button" onClick={onStartGame}>
                Start Game
              </button>
            ) : (
              <button className="menu-primary-button" type="button" onClick={copyInviteLink}>
                {copied ? 'Link copied!' : 'Copy invite link'}
              </button>
            )}

            <p className="waiting-player-count">
              Players in room: {players.length}/{capacity}
            </p>
            {players.length > 0 && (
              <ul className="waiting-player-list">
                {players.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {!canStart && (
          <div className="waiting-spinner" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}

        <p className="waiting-status">{statusText}</p>
      </div>
    </div>
  );
}
