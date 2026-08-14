import { RoomDifficulty, ZombieType } from '../types.js';

export type OrchestrationStep =
  | { kind: 'time'; seconds: number }
  | { kind: 'event'; zombies: { type: ZombieType; count: number }[]; seconds: number };

// Hardcoded, fully deterministic level scripts, one per difficulty: 'time'
// steps are a pause before advancing, 'event' steps spawn the listed
// zombies spread evenly across `seconds`. See defaultGameEngine.ts
// advanceOrchestration, which selects the right list via room.difficulty.
// The first 'time' step in each list doubles as the pre-game delay.
//
// Each difficulty now ends on a brute (the boss-tier zombie, see ZOMBIE_DEFS),
// so a run has a climax rather than just petering out on the last ordinary
// wave. Note zombies within an 'event' step spawn in list order, spread evenly
// across `seconds` — so listing the brute last means its escort arrives first
// and it walks in behind them.
//
// The win condition already requires a clear board (advanceOrchestration only
// declares a win once the step list is exhausted AND room.zombies is empty),
// so a brute still lumbering up the lawn correctly holds the win open.
export const ORCHESTRATION_STEPS_BY_DIFFICULTY: Record<RoomDifficulty, OrchestrationStep[]> = {
  easy: [
    { kind: 'time', seconds: 8 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 2 }], seconds: 20 },
    { kind: 'time', seconds: 10 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }], seconds: 22 },
    { kind: 'time', seconds: 10 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }, { type: 'runner', count: 1 }], seconds: 22 },
    // A long pause before the boss: on easy it should read as a clearly
    // telegraphed final beat you get time to prepare for.
    { kind: 'time', seconds: 12 },
    { kind: 'event', zombies: [{ type: 'brute', count: 1 }], seconds: 6 },
  ],
  medium: [
    { kind: 'time', seconds: 6 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }], seconds: 18 },
    { kind: 'time', seconds: 8 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 4 }, { type: 'runner', count: 2 }], seconds: 20 },
    { kind: 'time', seconds: 8 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }, { type: 'runner', count: 5 }], seconds: 20 },
    { kind: 'time', seconds: 10 },
    { kind: 'event', zombies: [{ type: 'runner', count: 3 }, { type: 'brute', count: 1 }], seconds: 10 },
  ],
  hard: [
    { kind: 'time', seconds: 4 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 4 }, { type: 'runner', count: 2 }], seconds: 16 },
    { kind: 'time', seconds: 5 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 5 }, { type: 'runner', count: 4 }], seconds: 18 },
    { kind: 'time', seconds: 5 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 4 }, { type: 'runner', count: 8 }], seconds: 18 },
    { kind: 'time', seconds: 6 },
    // Two brutes, and the escort is heavy enough that they can't simply be
    // ignored while you focus the bosses down.
    { kind: 'event', zombies: [{ type: 'runner', count: 6 }, { type: 'brute', count: 2 }], seconds: 14 },
  ],
};
