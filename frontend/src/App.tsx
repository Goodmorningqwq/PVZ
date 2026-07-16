import React, { useEffect, useMemo, useState } from 'react';
import { connect, connectDemo, connectOnePlayer, disconnect, onRoomJoined } from './network';
import RoomMenu from './pages/RoomMenu/RoomMenu';
import WaitingRoom from './pages/WaitingRoom/WaitingRoom';
import Game from './pages/Game/Game';
import './App.css';

type Phase = 'menu' | 'waiting' | 'playing';

function getSearchParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

function getOrCreateSessionId() {
  const storageKey = 'pvz-session-id';

  try {
    const existingId = window.localStorage.getItem(storageKey);
    if (existingId) {
      return existingId;
    }

    const createdId = window.crypto?.randomUUID?.() || `session-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(storageKey, createdId);
    return createdId;
  } catch {
    return window.crypto?.randomUUID?.() || `session-${Math.random().toString(16).slice(2)}`;
  }
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Connecting...');

  const playerId = useMemo(() => getSearchParam('player') || getOrCreateSessionId(), []);
  const demoMode = useMemo(() => {
    const demoValue = getSearchParam('demo');
    return demoValue === '1' || demoValue === 'true';
  }, []);
  const onePlayerMode = useMemo(() => {
    const soloValue = getSearchParam('solo');
    return soloValue === '1' || soloValue === 'true';
  }, []);

  // roomId starts from the URL (so shared links still work) but is otherwise
  // controlled by the room menu below, not required to be hand-typed into the URL.
  // This is deliberately never overwritten by the server's confirmed room id
  // (see confirmedRoomId below) - it's a dependency of the connect effect, so
  // feeding the confirmed id back into it would retrigger that effect
  // (disconnect + reconnect) every time it changed, looping forever for
  // demo/solo rooms where the server assigns a fresh id per connection.
  const [activeRoomId, setActiveRoomId] = useState(() => getSearchParam('room'));
  const [confirmedRoomId, setConfirmedRoomId] = useState('');
  const [phase, setPhase] = useState<Phase>(() => {
    if (demoMode || onePlayerMode || getSearchParam('room')) return 'waiting';
    return 'menu';
  });

  function joinRoom(roomId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url.toString());
    setActiveRoomId(roomId);
    setPhase('waiting');
  }

  function playDemo() {
    const url = new URL(window.location.href);
    url.searchParams.set('demo', '1');
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  }

  function playSolo() {
    const url = new URL(window.location.href);
    url.searchParams.set('solo', '1');
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  }

  // Socket lifecycle: connect as soon as a room is chosen, well before the
  // Game page ever mounts. The "waiting for opponent" screen is plain HTML
  // (WaitingRoom) rather than Phaser canvas text, so there's nothing to
  // render until the match actually starts.
  useEffect(() => {
    if (phase === 'menu' || (!demoMode && !onePlayerMode && !activeRoomId)) {
      return;
    }

    setSocketStatus('Connecting...');
    if (demoMode) {
      connectDemo({ playerId });
    } else if (onePlayerMode) {
      connectOnePlayer({ playerId });
    } else {
      connect({ roomId: activeRoomId, playerId });
    }

    const offRoomJoined = onRoomJoined((payload) => {
      const joinedRoomId = payload?.roomId ? String(payload.roomId) : activeRoomId;

      setConfirmedRoomId(joinedRoomId);
      setSocketStatus('Room joined');
      setConnected(true);
      setPhase('playing');
    });

    return () => {
      offRoomJoined();
      disconnect();
    };
    // Deliberately depends on (phase === 'menu') rather than `phase` itself:
    // this effect should stay connected across the waiting -> playing
    // transition, not tear down and reconnect when the match starts.
  }, [demoMode, onePlayerMode, phase === 'menu', activeRoomId, playerId]);

  if (phase === 'menu') {
    return <RoomMenu onJoin={joinRoom} onPlayDemo={playDemo} onPlaySolo={playSolo} />;
  }

  if (phase === 'waiting') {
    return <WaitingRoom roomId={activeRoomId} statusText={socketStatus} isDemo={demoMode} isSolo={onePlayerMode} />;
  }

  return (
    <Game
      roomId={confirmedRoomId || activeRoomId}
      playerId={playerId}
      demoMode={demoMode}
      onePlayerMode={onePlayerMode}
      socketStatus={socketStatus}
      connected={connected}
    />
  );
}
