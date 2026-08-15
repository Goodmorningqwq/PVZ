import React, { useEffect, useRef, useState } from 'react';
import { backToMenu, copyInviteLink, shortId } from '../shared/session';

type WaitingRoomProps = {
  roomId: string;
  statusText: string;
  isDemo?: boolean;
  isSolo?: boolean;
  players?: string[];
  capacity?: number;
  canStart?: boolean;
  onStartGame?: () => void;
  // Marks which entry in the player list is you. Optional so the demo/solo
  // branches, which have no list, don't have to pass it.
  playerId?: string;
};

type CopyState = 'idle' | 'copied' | 'failed';

export default function WaitingRoom({
  roomId,
  statusText,
  isDemo,
  isSolo,
  players = [],
  capacity = 2,
  canStart = false,
  onStartGame,
  playerId = '',
}: WaitingRoomProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const copyResetRef = useRef<number | null>(null);

  // The reset timer outlives the component otherwise: the room filling up
  // unmounts this screen, and the pending setState then fires against a dead
  // component.
  useEffect(() => () => {
    if (copyResetRef.current) {
      window.clearTimeout(copyResetRef.current);
    }
  }, []);

  async function handleCopy() {
    const ok = await copyInviteLink();
    setCopyState(ok ? 'copied' : 'failed');

    if (copyResetRef.current) {
      window.clearTimeout(copyResetRef.current);
    }
    copyResetRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
  }

  function copyLabel() {
    if (copyState === 'copied') return 'Link copied!';
    // Previously a failed copy left the label unchanged, which is
    // indistinguishable from the click not registering.
    if (copyState === 'failed') return `Copy failed — code is ${roomId}`;
    return 'Copy invite link';
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
              <button className="menu-primary-button" type="button" onClick={handleCopy}>
                {copyLabel()}
              </button>
            )}

            <p className="waiting-player-count">
              Players in room: {players.length}/{capacity}
            </p>
            {players.length > 0 && (
              <ul className="waiting-player-list">
                {players.map((id) => (
                  <li key={id}>
                    {shortId(id)}
                    {id === playerId && ' (you)'}
                  </li>
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

        {/* aria-live so the state changes this screen exists to report —
            "Room full", "Game in progress" — are actually announced. */}
        <p className="waiting-status" aria-live="polite">{statusText}</p>

        {/* There was previously no way off this screen at all. Back doesn't
            help either: every transition into here used history.replaceState,
            so no history entry was ever pushed. */}
        <button className="menu-link-button" type="button" onClick={backToMenu}>
          Leave room
        </button>
      </div>
    </div>
  );
}
