import React from 'react';
import { backToMenu } from '../shared/session';

type GameInProgressProps = {
  roomId: string;
};

export default function GameInProgress({ roomId }: GameInProgressProps) {
  return (
    <div className="menu-backdrop waiting-room-backdrop">
      <div className="menu-card">
        <h1 className="menu-title">Game in progress</h1>
        <p className="menu-subtitle">Room {roomId}</p>
        <p className="waiting-status">
          This room already has two players. Wait for the match to finish, or start your own.
        </p>

        {/* This screen previously had no controls at all, and the state
            backing it was never cleared — so once you hit a full room you were
            stuck here until a manual reload, even after that match ended.
            backToMenu is a full navigation, which is what actually clears it. */}
        <button className="menu-primary-button" type="button" onClick={backToMenu}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
