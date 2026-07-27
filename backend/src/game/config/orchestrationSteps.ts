import { RoomDifficulty, ZombieType } from '../types.js';

export type OrchestrationStep =
  | { kind: 'time'; seconds: number }
  | { kind: 'event'; zombies: { type: ZombieType; count: number }[]; seconds: number };

// Hardcoded, fully deterministic level scripts, one per difficulty: 'time'
// steps are a pause before advancing, 'event' steps spawn the listed
// zombies spread evenly across `seconds`. See defaultGameEngine.ts
// advanceOrchestration, which selects the right list via room.difficulty.
// The first 'time' step in each list doubles as the pre-game delay.
export const ORCHESTRATION_STEPS_BY_DIFFICULTY: Record<RoomDifficulty, OrchestrationStep[]> = {
  easy: [
    { kind: 'time', seconds: 8 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 2 }], seconds: 20 },
    { kind: 'time', seconds: 10 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }], seconds: 22 },
    { kind: 'time', seconds: 10 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }, { type: 'runner', count: 1 }], seconds: 22 },
  ],
  medium: [
    { kind: 'time', seconds: 6 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }], seconds: 18 },
    { kind: 'time', seconds: 8 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 4 }, { type: 'runner', count: 2 }], seconds: 20 },
    { kind: 'time', seconds: 8 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 3 }, { type: 'runner', count: 5 }], seconds: 20 },
  ],
  hard: [
    { kind: 'time', seconds: 4 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 4 }, { type: 'runner', count: 2 }], seconds: 16 },
    { kind: 'time', seconds: 5 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 5 }, { type: 'runner', count: 4 }], seconds: 18 },
    { kind: 'time', seconds: 5 },
    { kind: 'event', zombies: [{ type: 'shambler', count: 4 }, { type: 'runner', count: 8 }], seconds: 18 },
  ],
};
