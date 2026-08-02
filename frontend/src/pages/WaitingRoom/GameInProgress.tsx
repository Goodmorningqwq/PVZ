import React from 'react';

type GameInProgressProps = {
  roomId: string;
};

export default function GameInProgress({ roomId }: GameInProgressProps) {
  return (
    <div className="menu-backdrop waiting-room-backdrop">
      <div className="menu-card">
        <h1 className="menu-title">Game in progress</h1>
        <p className="menu-subtitle">Room {roomId} already has two players battling zombies.</p>
        <p className="waiting-status">Wait for this match to finish before joining.</p>
      </div>
    </div>
  );
}
