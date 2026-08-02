import React, { useEffect, useMemo, useState } from 'react';
import {
  connect,
  connectDemo,
  connectOnePlayer,
  disconnect,
  emitStartGame,
  onActionRejected,
  onGameStarted,
  onRoomJoined,
  onRoomPlayersUpdate,
} from './network';
import ModeSelect from './pages/ModeSelect/ModeSelect';
import GameSettings, { Difficulty } from './pages/GameSettings/GameSettings';
import WaitingRoom from './pages/WaitingRoom/WaitingRoom';
import GameInProgress from './pages/WaitingRoom/GameInProgress';
import Game from './pages/Game/Game';
import './App.css';

type Phase = 'mode-select' | 'settings' | 'waiting' | 'playing';
type SelectedMode = 'multiplayer' | 'singleplayer' | null;

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

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
  // controlled by the settings page below, not required to be hand-typed into the URL.
  // This is deliberately never overwritten by the server's confirmed room id
  // (see confirmedRoomId below) - it's a dependency of the connect effect, so
  // feeding the confirmed id back into it would retrigger that effect
  // (disconnect + reconnect) every time it changed, looping forever for
  // demo/solo rooms where the server assigns a fresh id per connection.
  const [activeRoomId, setActiveRoomId] = useState(() => getSearchParam('room'));
  const [confirmedRoomId, setConfirmedRoomId] = useState('');
  const [waitingPlayers, setWaitingPlayers] = useState<string[]>([]);
  const [waitingCapacity, setWaitingCapacity] = useState(2);
  const [roomInProgress, setRoomInProgress] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SelectedMode>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const raw = getSearchParam('difficulty');
    return (VALID_DIFFICULTIES as string[]).includes(raw) ? (raw as Difficulty) : 'medium';
  });
  const [phase, setPhase] = useState<Phase>(() => {
    if (demoMode || onePlayerMode || getSearchParam('room')) return 'waiting';
    return 'mode-select';
  });

  function selectMode(mode: 'multiplayer' | 'singleplayer') {
    setSelectedMode(mode);
    setPhase('settings');
  }

  function backToModeSelect() {
    setPhase('mode-select');
  }

  function handleStartGame() {
    emitStartGame({ roomId: confirmedRoomId || activeRoomId, playerId });
  }

  function startMultiplayer(roomId: string, chosenDifficulty: Difficulty) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    url.searchParams.set('difficulty', chosenDifficulty);
    window.history.replaceState({}, '', url.toString());
    setActiveRoomId(roomId);
    setDifficulty(chosenDifficulty);
    setPhase('waiting');
  }

  function startSolo(chosenDifficulty: Difficulty) {
    const url = new URL(window.location.href);
    url.searchParams.set('solo', '1');
    url.searchParams.set('difficulty', chosenDifficulty);
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  }

  function playDemo() {
    const url = new URL(window.location.href);
    url.searchParams.set('demo', '1');
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  }

  // Socket lifecycle: connect as soon as a room is chosen, well before the
  // Game page ever mounts. The "waiting for opponent" screen is plain HTML
  // (WaitingRoom) rather than Phaser canvas text, so there's nothing to
  // render until the match actually starts.
  const isPreConnectPhase = phase === 'mode-select' || phase === 'settings';

  useEffect(() => {
    if (isPreConnectPhase || (!demoMode && !onePlayerMode && !activeRoomId)) {
      return;
    }

    setSocketStatus('Connecting...');
    if (demoMode) {
      connectDemo({ playerId });
    } else if (onePlayerMode) {
      connectOnePlayer({ playerId, difficulty });
    } else {
      connect({ roomId: activeRoomId, playerId, difficulty });
    }

    const offRoomJoined = onRoomJoined((payload) => {
      const joinedRoomId = payload?.roomId ? String(payload.roomId) : activeRoomId;

      setConfirmedRoomId(joinedRoomId);
      setConnected(true);

      // Demo/solo rooms only ever hold one player, so joining means playing.
      // A twoPlayer room only jumps straight in here if it was already
      // started — i.e. this is a reconnect to a match in progress, not the
      // first time the room filled up (that case waits for start_game).
      if (demoMode || onePlayerMode || payload?.started) {
        setSocketStatus('Room joined');
        setPhase('playing');
      } else {
        setSocketStatus('Room full');
      }
    });

    const offGameStarted = onGameStarted(() => {
      setSocketStatus('Room joined');
      setConnected(true);
      setPhase('playing');
    });

    const offRoomPlayersUpdate = onRoomPlayersUpdate((payload) => {
      const players = Array.isArray(payload?.players) ? payload.players.map(String) : [];
      setWaitingPlayers(players);
      if (Number.isFinite(payload?.capacity)) {
        setWaitingCapacity(payload.capacity);
      }
    });

    const offActionRejected = onActionRejected((payload) => {
      if (payload?.action !== 'join_room') {
        return;
      }
      if (payload?.reason === 'game_in_progress') {
        setRoomInProgress(true);
        setSocketStatus('Game in progress');
      } else if (payload?.reason === 'room_full') {
        setSocketStatus('Room is full');
      }
    });

    return () => {
      offRoomJoined();
      offGameStarted();
      offRoomPlayersUpdate();
      offActionRejected();
      disconnect();
    };
    // Deliberately depends on isPreConnectPhase rather than `phase` itself:
    // this effect should stay connected across the waiting -> playing
    // transition, not tear down and reconnect when the match starts.
  }, [demoMode, onePlayerMode, isPreConnectPhase, activeRoomId, playerId, difficulty]);

  if (phase === 'mode-select') {
    return <ModeSelect onSelectMode={selectMode} onPlayDemo={playDemo} />;
  }

  if (phase === 'settings' && selectedMode) {
    return (
      <GameSettings
        mode={selectedMode}
        onBack={backToModeSelect}
        onStartSolo={startSolo}
        onStartMultiplayer={startMultiplayer}
      />
    );
  }

  if (phase === 'waiting') {
    if (roomInProgress) {
      return <GameInProgress roomId={activeRoomId} />;
    }

    const canStart = !demoMode && !onePlayerMode && waitingCapacity > 0 && waitingPlayers.length >= waitingCapacity;

    return (
      <WaitingRoom
        roomId={activeRoomId}
        statusText={socketStatus}
        isDemo={demoMode}
        isSolo={onePlayerMode}
        players={waitingPlayers}
        capacity={waitingCapacity}
        canStart={canStart}
        onStartGame={handleStartGame}
      />
    );
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
