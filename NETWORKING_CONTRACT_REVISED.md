# PvZ Multiplayer — Networking Contract (REVISED)

**Reconciled July 12, 2026:** this document previously described a *planned* contract
(`match_found`/`game_tick`/`plant_placed`) that was never actually implemented. The
sections below now match what `backend/src/index.ts` and `frontend/src/network.js`
actually send and receive today. Events described in the old draft that don't exist
in code are listed at the bottom under "Not implemented" so we don't lose the design
intent, but nothing should be built against them without updating the backend first.

This is the shared data contract between frontend and backend. Both must implement exactly this shape.

---

## Client → Server Events (as implemented)

### `join_room`
Sent once when player enters a room. The client generates its own `playerId`
(persisted in `localStorage`) and sends it — the server does **not** generate it.

```json
{
  "roomId": "abc123",
  "playerId": "session-a1b2c3"
}
```

There is no ack callback. The server responds asynchronously via `room_joined` once
both players are present.

---

### `place_plant`
Sent when player clicks anywhere on the board. There is no plant-type field yet —
every placement is hard-coded to `peashooter` (cost 100) server-side.

```json
{
  "roomId": "abc123",
  "playerId": "session-a1b2c3",
  "x": 240,
  "y": 180
}
```

There is no ack callback and no error event. If sun is insufficient or the tile is
occupied, the server silently drops the request — the client gets no feedback
beyond nothing changing on the next `state_update`.

---

### `remove_plant` — **not implemented.** No handler exists on the backend.

---

## Server → Client Events (as implemented)

### `room_joined`
Sent to both players once two have joined the same room. Signals transition from lobby to game.

```json
{
  "roomId": "abc123",
  "playerId": "session-a1b2c3",
  "opponentId": "session-d4e5f6"
}
```

---

### `plant_placed` — **not implemented.** Plant placements are only visible via the next `state_update`, not a dedicated broadcast.

---

### `state_update`
Broadcast to both players on every server tick (currently `TICK_RATE=15`, configurable via env). **This is the ONLY source of render truth** — frontend never derives game state itself.

```json
{
  "tick": 482,
  "towers": [
    {
      "id": "t-1",
      "x": 240,
      "y": 180,
      "type": "peashooter",
      "owner": "session-a1b2c3",
      "hp": 100
    }
  ],
  "zombies": [
    {
      "id": "z-1",
      "x": 620,
      "y": 180,
      "hp": 20
    }
  ],
  "sun": {
    "session-a1b2c3": 75,
    "session-d4e5f6": 50
  }
}
```

Differences from the original design: plants and zombies are flat arrays (not
keyed by player, not wrapped in a `plants` object), there is no `wave` field, no
`timestamp` field, and no `type` field on zombies.

**Note:** Frontend renders this state directly. No client-side prediction of state changes — only visual smoothing/interpolation of positions.

---

### `game_over`
Sent once when a zombie's x-position reaches ≤ 0 (there's no real "lawn breach at a
specific line" yet, no wave counter, and no match duration tracking).

```json
{
  "winnerId": "session-a1b2c3",
  "reason": "opponent_lawn_breached"
}
```

No `matchId`, `finalWave`, or `duration` fields exist.

---

### `opponent_disconnected` — **not implemented.** On disconnect the backend just removes the player from the room (and deletes the room if empty) with no grace period and no notification to the remaining player.

---

### `connection_restored` — **not implemented** (follows from the above — there's no reconnection flow to restore).

---

### `action_rejected` — **not implemented.** Invalid `place_plant` requests are dropped silently (see above).

---

## Constants (Shared)

Both frontend and backend must agree on these values:

### Plant Costs
```javascript
{
  "peashooter": 100,
  "sunflower": 50
}
```

### Plant Stats
```javascript
{
  "peashooter": {
    "cost": 100,
    "health": 100,
    "damage": 10,
    "fireRate": 1.5, // shots per second
    "range": 200
  },
  "sunflower": {
    "cost": 50,
    "health": 100,
    "sunPerSecond": 2
  }
}
```

### Game Rules
```javascript
{
  "TICK_RATE": 15,              // ticks per second
  "INITIAL_SUN": 50,            // sun at game start
  "SUN_PER_SECOND": 2,          // base sun generation
  "MAX_LANE_WIDTH": 800,        // pixels
  "ZOMBIE_SPEED": 1.5,          // pixels per second
  "LAWN_BREACH_X": 40,          // x position where zombie wins
  "GAME_WIDTH": 800,
  "GAME_HEIGHT": 400
}
```

---

## Rules Both Sides MUST Follow

1. **Field names, casing, and nesting match exactly**
   - ✅ `playerName`, not `player_name`
   - ✅ `plantId`, not `plant_id`
   - ✅ `matchId`, not `match_id`

2. **Every field is always present**, even when empty
   - ✅ `"plants": { "playerA": [], "playerB": [] }` (not omitted if empty)
   - ❌ Don't omit `"plantId"` if plant placement fails

3. **Server is the only writer of truth**
   - ✅ Frontend sends `place_plant` intent
   - ❌ Frontend never assumes plant placed until it appears in next `game_tick`
   - ✅ Frontend receives `game_tick` and renders that state exactly

4. **IDs are always strings**
   - ✅ `"playerId": "player_9f8a2"`
   - ❌ Never `"playerId": 123`

5. **Coordinates are always numbers** (pixels)
   - ✅ `"x": 240, "y": 180`
   - ❌ Never strings or percentages

6. **Timestamps are ISO 8601 strings**
   - ✅ `"2026-07-12T04:32:43.613Z"`
   - ❌ Never milliseconds or other formats

7. **No client-side prediction of game state**
   - ✅ Frontend can optimistically show plant while waiting for server confirmation
   - ✅ Frontend interpolates zombie movement between ticks for smooth animation
   - ❌ Frontend never calculates zombie damage or collision detection
   - ❌ Frontend never adds/removes plants except when server says so

---

## Error Handling — **not implemented**

The pattern below was the design intent but nothing in `backend/src/index.ts` emits
structured errors today. Invalid `place_plant` calls (insufficient sun, occupied
tile) are just dropped with no signal to the client.

```json
{
  "success": false,
  "code": "INSUFFICIENT_SUN",
  "message": "You need 100 sun to place a peashooter",
  "details": {
    "required": 100,
    "available": 75
  }
}
```

---

## Reconnection Flow — **not implemented**

The flow below is the design intent, not current behavior. Today, disconnect
immediately removes the player from `room.players`; if that empties the room, the
room itself is deleted. There is no grace period and no `opponent_disconnected` /
`connection_restored` messaging.

1. Player 1 disconnects → Server holds match state for 30 seconds
2. Server sends `opponent_disconnected` to Player 2
3. Player 1 reconnects → Server sends full `state_update`
4. Server broadcasts `connection_restored` to both players
5. Game continues from where it was

---

## Sample Message Sequence (as implemented)

```
1. Player A → Server: join_room { roomId: "room1", playerId: "session-a1b2c3" }
2. Player B → Server: join_room { roomId: "room1", playerId: "session-d4e5f6" }
3. Server → Both:     room_joined { roomId, playerId, opponentId }
4. Server → Both:     state_update (tick 0, towers: [], zombies: [initial zombie])
5. Player A → Server: place_plant { roomId, playerId: A, x: 240, y: 180 }
6. Server → Both:     state_update (towers now includes A's peashooter, sun decreased for A)
7. [Every tick, ~67ms at TICK_RATE=15] state_update (zombie x decreases by ZOMBIE_SPEED each tick)
8. Zombie x <= 0      → game_over { winnerId, reason: "opponent_lawn_breached" }
```

---

## Gap Summary: Design Intent vs. Implementation

| What | Originally Designed | Actually Implemented |
|------|----------|---------|
| Lobby signal | `match_found` with matchId/startTime | `room_joined` with roomId/playerId/opponentId |
| State broadcast | `game_tick`, plants keyed by player, wave counter | `state_update`, flat `towers`/`zombies` arrays, no wave |
| Plant placement feedback | `plant_placed` broadcast + ack callback | None — client infers from next `state_update` |
| Plant types | peashooter + sunflower selectable | Hard-coded to peashooter only |
| Error handling | Structured `action_rejected` / callback errors | Silent drop |
| Reconnection | 30s grace period + `opponent_disconnected`/`connection_restored` | Immediate removal, no grace period, no messaging |
| Zombies | Multiple per wave, `type` field, wave progression | One zombie per room, no waves, no type field |
| Persistence | Supabase writes every 30s | Not implemented — `@supabase/supabase-js` and `@upstash/redis` are installed but unused |

---

## Implementation Checklist

### Backend
- [x] Emit `room_joined` when 2 players join
- [x] Validate `place_plant` before applying (sun check, tile-occupied check)
- [x] Broadcast `state_update` at `TICK_RATE` (default 15/s)
- [x] Emit `game_over` when a zombie reaches x <= 0
- [ ] Handle disconnect with 30-second grace period
- [ ] Emit `plant_placed` / `action_rejected` for client feedback
- [ ] Implement plant damage to zombies (zombies currently never take damage)
- [ ] Implement zombie waves (currently one static zombie per room)
- [ ] Wire up Supabase persistence (dependency installed, no code uses it)
- [ ] Validate constants match frontend

### Frontend
- [x] Parse `room_joined` → transition to GameScene
- [x] Render towers from `state_update.towers`
- [x] Render zombies from `state_update.zombies`
- [x] Render sun from `state_update.sun`
- [x] Send `place_plant` on user click
- [ ] Handle opponent-disconnect messaging (no such event exists yet)
- [ ] Interpolate zombie positions between ticks (currently snaps to each tick)
- [ ] Support plant type selection (UI + payload only ever sends peashooter)

---

## Next Steps

1. Implement zombie waves and real plant → zombie combat (damage, death, scoring).
2. Add the 30-second reconnect grace period and `opponent_disconnected` messaging.
3. Either wire up the Supabase/Upstash persistence that's already installed as a
   dependency, or remove it from `package.json` and drop the "persistence" claims
   from the project guide until it's built.
4. Add plant-type selection in the UI and `place_plant` payload.
5. Add structured error feedback so failed placements aren't silently dropped.
