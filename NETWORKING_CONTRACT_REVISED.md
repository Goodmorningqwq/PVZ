# PvZ Multiplayer — Networking Contract (REVISED)

**Reconciled July 12, 2026 (combat/wave update, then 5-lane update same day):** the
game changed from a single freeform-placement peashooter sandbox to a slot-based
co-op tower defense: originally one shared lane with 8 fixed slots, now **5
shared lanes with 8 fixed slots each (40 slots total)**, real peashooter/sunflower
combat scoped per lane, a zombie wave scheduler that spawns into a random lane,
and a shared-income economy. This document reflects that system as implemented
in `backend/src/index.ts` and consumed by `frontend/src/network.js`. Sections
describing older, still-unbuilt design intent (reconnection, structured errors,
persistence) are kept at the bottom so we don't lose that context.

This is the shared data contract between frontend and backend. Both must implement exactly this shape.

---

## Game model (as implemented)

5 shared lanes, one shared lawn, defended cooperatively by both players:

- **5 lanes × 8 fixed slots (40 total)** — classic PvZ-style grid (`backend/src/index.ts` `buildSlots()` / `frontend/src/scenes/GameScene/constants.js` `getSlotPositions()` — both must derive the same positions from the same `BOARD_WIDTH`/`BOARD_HEIGHT`/`LANE_COUNT`/`SLOT_MARGIN`/`SLOT_COUNT`). Every slot and zombie carries a `laneIndex` (0-4). Either player can place into any open slot in **any lane** — placement rights are fully shared, not split per player and not split per lane.
- **Two plant types**: `peashooter` (100 sun, 100 HP, fires at the nearest zombie *in the same lane* at or ahead of its slot every ~1.4s for 20 damage) and `sunflower` (50 sun, 100 HP, produces 25 sun every ~24s).
- **Shared sun income**: each player has a separate purse for spending, but every sunflower proc adds to *both* purses regardless of who placed it. This is intentional — see project guide for the design reasoning.
- **Zombie waves**: a shared schedule (`WAVES` in `backend/src/index.ts`) spawns increasing numbers of zombies with decreasing gaps between waves; each zombie spawns into a uniformly random lane. A zombie only interacts with plants/zombies in its own lane — it stops at an occupied slot in its lane and chomps that plant (20 dmg/sec) instead of continuing to advance.
- **Win/loss is shared, not per-player**: surviving every configured wave means both players win; any zombie in any lane reaching x ≤ 0 means both players lose. There is no "opponent" to defeat — the only opponent is the zombies.

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
Sent when the player has a plant selected in the shop bar and clicks an open slot.

```json
{
  "roomId": "abc123",
  "playerId": "session-a1b2c3",
  "plant": "peashooter",
  "slotIndex": 19
}
```

`slotIndex` is a flat global index across all 40 slots, `laneIndex * 8 + col` (0-39) — not
a per-lane column number. The client reads the target slot's own `index` field (from the
latest `state_update`) and echoes it back verbatim, so it never has to compute this formula itself.

There is no ack callback and no error event. If the player's own sun is insufficient
or the slot is already occupied, the server silently drops the request — the client
gets no feedback beyond nothing changing on the next `state_update`.

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
  "slots": [
    {
      "index": 19,
      "laneIndex": 2,
      "x": 400,
      "y": 200,
      "plant": {
        "type": "peashooter",
        "hp": 100,
        "ownerId": "session-a1b2c3"
      }
    }
  ],
  "zombies": [
    { "id": "z-1", "laneIndex": 2, "x": 620, "y": 200, "hp": 20 }
  ],
  "sun": {
    "session-a1b2c3": 75,
    "session-d4e5f6": 75
  },
  "wave": 2,
  "waveStatus": "spawning",
  "totalWaves": 3
}
```

`slots` is always the full 40-element array (5 lanes × 8 slots, empty ones have
`plant: null`), so the frontend never has to track slot state itself beyond
what's in the latest tick. Every slot and zombie carries `laneIndex` (0-4);
combat, chomping, and blocking are all scoped to matching `laneIndex` only —
a peashooter never fires across lanes. `waveStatus` is one of `pending` (before
wave 1 starts), `spawning` (zombies still being introduced or alive), `break`
(between waves), or `complete` (all waves cleared). Cooldown/timer internals
(`slot.plant.cooldown`, `sunTimer`, `zombie.chompCooldown`) are server-only and
stripped before broadcast.

**Note:** Frontend renders this state directly. No client-side prediction of state changes — only visual smoothing/interpolation of positions (not yet implemented; zombies currently snap to position each tick).

---

### `game_over`
Sent once when either every wave is cleared (co-op win) or a zombie reaches x ≤ 0 (co-op loss). There's no per-player winner — both players see the same result.

```json
{
  "result": "win",
  "reason": "all_waves_cleared"
}
```

or

```json
{
  "result": "lose",
  "reason": "lawn_breached"
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

## Constants (Shared — must match between `backend/src/index.ts` and `frontend/src/scenes/GameScene/constants.js`)

```javascript
// Board layout
{
  "BOARD_WIDTH": 800,
  "BOARD_HEIGHT": 400,   // frontend calls this GAME_HEIGHT
  "LANE_COUNT": 5,
  "LANE_MARGIN": 40,     // first/last lane's y-offset from the top/bottom edge
  "SLOT_COUNT": 8,       // per lane — 40 slots total
  "SLOT_MARGIN": 48,
}
// LANE_SPACING and per-lane y are derived, not sent over the wire:
// LANE_SPACING = (BOARD_HEIGHT - LANE_MARGIN * 2) / (LANE_COUNT - 1)
// laneY(i) = LANE_MARGIN + LANE_SPACING * i

// Plants
{
  "peashooter": { "cost": 100, "hp": 100, "damage": 20, "cooldownSeconds": 1.4 },
  "sunflower":  { "cost": 50,  "hp": 100, "sunAmount": 25, "intervalSeconds": 24 }
}

// Zombies / waves
{
  "ZOMBIE_HP": 20,
  "ZOMBIE_SPEED_PX_PER_TICK": 1,
  "ZOMBIE_CHOMP_DAMAGE": 20,
  "ZOMBIE_CHOMP_INTERVAL_SECONDS": 1,
  "WAVES": [
    { "count": 3, "spawnGapSeconds": 6 },
    { "count": 5, "spawnGapSeconds": 5 },
    { "count": 7, "spawnGapSeconds": 4 }
  ],
  "WAVE_BREAK_SECONDS": 8,
  "PRE_GAME_DELAY_SECONDS": 6
}

// Economy
{
  "STARTING_SUN": 150,
  "TICK_RATE": 15
}
```

**Tuned July 12, 2026 after playtesting:** the original numbers (50 starting sun, zombie speed 2 px/tick, 3s pre-game delay) made wave 1 unwinnable — a peashooter (100 sun) was unaffordable with 50 starting sun and purses don't combine, and a sunflower's ~24s first payout roughly matched a zombie's ~26s board-crossing time, leaving no window to build any defense. Starting sun raised to 150 (affords an immediate peashooter), zombie speed halved (~52s crossing time), and the pre-game delay doubled to give more time to coordinate a first placement. Still a first pass, not final balance.

---

## Rules Both Sides MUST Follow

1. **Field names, casing, and nesting match exactly**
   - ✅ `slotIndex`, not `slot_index`
   - ✅ `ownerId`, not `owner_id`

2. **`slots` is always the full fixed-length array**, even for empty slots (`plant: null`), not a sparse/partial list.

3. **Server is the only writer of truth**
   - ✅ Frontend sends `place_plant` intent
   - ❌ Frontend never assumes a plant is placed until it appears in the next `state_update`
   - ✅ Frontend receives `state_update` and renders that state exactly

4. **IDs are always strings**
   - ✅ `"playerId": "session_9f8a2"`
   - ❌ Never `"playerId": 123`

5. **Coordinates are always numbers** (pixels)
   - ✅ `"x": 240, "y": 200`
   - ❌ Never strings or percentages

6. **No client-side prediction of game state**
   - ❌ Frontend never calculates zombie damage, chomp damage, or sun income itself
   - ❌ Frontend never adds/removes plants except when the server says so via `state_update`

---

## Error Handling — **not implemented**

The pattern below was the design intent but nothing in `backend/src/index.ts` emits
structured errors today. Invalid `place_plant` calls (insufficient sun, occupied
slot) are just dropped with no signal to the client.

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
`connection_restored` messaging. This matters more now than before the wave system
existed — a mid-wave disconnect currently just ends the co-op session for whoever's left.

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
4. Server → Both:     state_update (tick 0, all 8 slots empty, no zombies, waveStatus: "pending")
5. [3s pre-game delay] waveStatus becomes "spawning", wave 1 zombies begin spawning on schedule
6. Player A → Server: place_plant { roomId, playerId: A, plant: "sunflower", slotIndex: 1 }
7. Server → Both:     state_update (slot 1 now has A's sunflower, sun deducted from A only)
8. [~24s later]       sunflower procs → both A and B's sun increase by 25
9. [Every tick]        state_update (zombies advance, peashooters fire on cooldown, chomping resolves)
10. All 3 waves cleared → game_over { result: "win", reason: "all_waves_cleared" }
    — or a zombie reaches x=0 → game_over { result: "lose", reason: "lawn_breached" }
```

---

## Gap Summary: Design Intent vs. Implementation

| What | Originally Designed | Actually Implemented |
|------|----------|---------|
| Lobby signal | `match_found` with matchId/startTime | `room_joined` with roomId/playerId/opponentId |
| Placement model | Freeform pixel x/y | Fixed 8-slot lane, shared placement rights |
| Plant types | peashooter + sunflower selectable | Both implemented, shop bar lets you pick |
| Combat | Damage, waves, win/loss | Implemented: cooldown-fire, chomp-on-contact, wave scheduler, co-op win/lose |
| Economy | Sun costs and generation | Implemented, with a twist: sunflower income is shared between both purses (not in any original doc — a design decision made mid-project) |
| Error handling | Structured `action_rejected` / callback errors | Silent drop |
| Reconnection | 30s grace period + `opponent_disconnected`/`connection_restored` | Immediate removal, no grace period, no messaging |
| Persistence | Supabase writes every 30s | Not implemented — `@supabase/supabase-js` and `@upstash/redis` are installed but unused |

---

## Implementation Checklist

### Backend
- [x] Emit `room_joined` when 2 players join
- [x] Validate `place_plant` against own purse + slot occupancy
- [x] Broadcast `state_update` at `TICK_RATE` (default 15/s)
- [x] Peashooter cooldown-based firing at nearest zombie ahead
- [x] Zombie chomp-on-contact damage to occupied slots
- [x] Shared sunflower income to both purses
- [x] Wave scheduler with escalating zombie counts
- [x] Co-op `game_over` (win on all waves cleared, lose on lawn breach)
- [ ] Handle disconnect with 30-second grace period
- [ ] Emit `plant_placed` / `action_rejected` for client feedback
- [ ] Wire up Supabase persistence (dependency installed, no code uses it)

### Frontend
- [x] Parse `room_joined` → transition to GameScene
- [x] Render plants from `state_update.slots`
- [x] Render zombies from `state_update.zombies`
- [x] Render sun from `state_update.sun`, labeled You/teammate
- [x] Shop bar for selecting plant type before placing
- [x] Wave status banner in the HUD
- [ ] Handle opponent-disconnect messaging (no such event exists yet)
- [ ] Interpolate zombie positions between ticks (currently snaps to each tick)
- [ ] Visible pea projectiles (combat is currently instant-hit, no projectile sprite)

---

## Next Steps

1. Add the 30-second reconnect grace period and `opponent_disconnected` messaging — now more important than before since a disconnect mid-wave currently just strands the remaining player.
2. Either wire up the Supabase/Upstash persistence that's already installed as a
   dependency, or remove it from `package.json` and drop the "persistence" claims
   from the project guide until it's built.
3. Add structured error feedback so failed placements (insufficient sun, occupied slot) aren't silently dropped.
4. Playtest and tune the numbers in the Constants section — current values are a first pass, not balanced.
5. Consider visible pea projectiles and zombie movement interpolation as polish once the core loop is confirmed fun.
