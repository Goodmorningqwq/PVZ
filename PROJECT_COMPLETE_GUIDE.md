# Multiplayer Plants vs. Zombies - Complete Project Guide

**Last Updated:** July 12, 2026 (combat/wave system implemented — game direction changed from competitive PvP to co-op)
**Status:** Backend Live ✅ | Core gameplay loop implemented 🟢 (slots, combat, waves, shared economy) | Needs playtesting/tuning and reconnection handling
**Repository:** https://github.com/Goodmorningqwq/PVZ
**Live Frontend:** https://pvz-frontend.vercel.app/ (not yet redeployed with the combat/wave update — needs commit + push)

---

## 📖 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [What's Completed](#whats-completed)
5. [Current Status](#current-status)
6. [Next Steps](#next-steps)
7. [Networking Contract](#networking-contract)
8. [Development Roadmap](#development-roadmap)
9. [Setup Instructions](#setup-instructions)
10. [Deployment Guide](#deployment-guide)

---

## Project Overview

**Multiplayer Plants vs. Zombies** is a real-time, browser-based **co-op** tower defense game. This is a deliberate change from the original "two players compete on parallel lanes" design: after discussion, the game is now two players defending **one shared 5-lane lawn together** against escalating zombie waves, with a shared sunflower economy. There's no PvP element — the only opponent is the zombies.

### Game Mode
- **Co-op defense**: two players share a 5-lane, 8-slots-per-lane grid (40 slots total) — a classic PvZ-style board. Either player can place a plant into any open slot, in any lane. Both win together if all waves are survived; both lose together if a zombie breaches the lawn in any lane.

### Core Gameplay (Implemented)
- ✅ Real-time synchronization (configurable tick rate, default 15/s)
- ✅ Server-authoritative game logic (all combat/economy resolved server-side, client only renders)
- ✅ Two plant types: Peashooter (100 sun, damage-over-cooldown, fires only within its own lane) and Sunflower (50 sun, sun income)
- ✅ 5 lanes × 8 fixed placement slots (40 total) — either player can place into any open slot in any lane; zombies spawn into a random lane and only interact with that lane
- ✅ Shop bar UI for selecting a plant before placing (replaces earlier "click anywhere always places peashooter" behavior)
- ✅ Zombie wave scheduler — 3 configured waves with escalating zombie counts and shrinking spawn gaps
- ✅ Zombies stop and "chomp" an occupied slot's plant instead of walking through it
- ✅ Shared sun economy: separate purses per player, but sunflower income (25 sun/proc) goes to **both** purses
- ✅ Co-op win/loss: survive all waves = both win; any lawn breach = both lose
- ✅ Room-code based session joining via a Kahoot-style menu (create/join by code, no more hand-typed URLs)

### Not Yet Implemented
- Reconnection handling (a disconnect mid-match currently just strands the remaining player — no grace period)
- Structured error feedback (failed placements are silently dropped)
- User accounts/login or persistent player profiles
- Persistent match history (Supabase is provisioned but not wired in)
- Additional plant/zombie types beyond peashooter/sunflower and the one zombie type
- Visible pea projectiles (combat is currently instant-hit) and zombie movement interpolation

---

## Architecture

### System Diagram

```
┌─────────────────────┐
│  Browser (Vercel)   │
│   Phaser 3 + React  │
└──────────┬──────────┘
           │ WebSocket
           ↓
┌──────────────────────────┐
│  Render Node.js Server   │
│  Express + Socket.io     │
│  (0.5 CPU, 512MB RAM)    │
└──────┬───────────────────┘
       │
       ├──→ Supabase PostgreSQL    [Persist every 30s]
       │    500MB storage
       │    Players, matches, game events
       │
       └──→ Upstash Redis          [Room queue only]
            30MB storage
            Session tokens, matchmaking

```

### Data Flow

```
Player Action (place_plant)
    ↓
Socket.io → Backend
    ↓
Server validates & updates state
    ↓
Persist to Supabase (every 30s)
    ↓
Broadcast to both players (game_tick)
    ↓
Frontend renders state
```

---

## Tech Stack

### Frontend
- **Framework**: Phaser 3 (game engine)
- **UI Framework**: React + TypeScript
- **Build Tool**: Vite
- **Real-time**: Socket.io client
- **Hosting**: Vercel (FREE)

### Backend
- **Runtime**: Node.js 24.14.1
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Language**: TypeScript
- **Hosting**: Render (FREE tier)

### Database
- **SQL**: PostgreSQL via Supabase (FREE tier)
  - 500MB storage
  - 50k API calls/month
  - Built-in Auth

### Cache
- **Redis**: Upstash (FREE tier)
  - 30MB storage
  - 10k commands/day
  - Serverless

### Cost
- **MVP Phase**: $0/month (free tier)
- **Growth Phase**: $34/month at 500+ concurrent players
  - Render: $7/mo
  - Supabase: $25/mo
  - Upstash: $2/mo

---

## What's Completed

### ✅ Infrastructure & Setup
- [x] GitHub repository created and organized
- [x] Folder structure fully set up (frontend, backend, docs)
- [x] Environment configuration templates (.env.example files)
- [x] Git configured and pushed to GitHub

### ✅ Backend (LIVE on Render)
- [x] Express.js server initialized
- [x] Socket.io integration complete
- [x] Game loop implemented (tick rate configurable via `TICK_RATE` env, default 15/s)
- [x] Room management system (single zombie per room, no wave progression yet)
- [x] Player connection handling
- [x] Plant placement validation (sun check + tile-occupied check; peashooter only)
- [x] Sun economy tracking (passive accrual only, no sunflower production yet)
- [x] Health check endpoint (`/api/health`) — verified live and responding
- [x] Statistics endpoint (`/api/stats`)
- [x] TypeScript configuration
- [x] Deployed and tested ✅
- [ ] **Match state persistence — NOT implemented.** `@supabase/supabase-js` and `@upstash/redis` are installed as dependencies but `backend/src/index.ts` never imports or calls either. All room state is in-memory only and lost on server restart.
- [ ] **Disconnect handling — NOT implemented.** There is no 30-second grace period; a disconnect immediately removes the player, and the room is deleted once empty. No `opponent_disconnected` event is sent.
- [ ] Plant damage to zombies (zombies currently take no damage and can't be killed)
- [ ] Zombie waves / multiple zombie types

**Backend URL:** https://pvz-backend-otiq.onrender.com

### 🟡 Database & Services
- [ ] Supabase/Upstash integration — accounts exist and credentials are configured in Render env vars, but no backend code uses them yet. Room/player/match state is not persisted anywhere; a server restart wipes all active games.

### ✅ Documentation
- [x] Complete technical proposal (FINAL_PROPOSAL.md)
- [x] Repository structure guide (REPO_STRUCTURE.md)
- [x] Networking contract (NETWORKING_CONTRACT_REVISED.md)
- [x] Setup instructions (GETTING_STARTED.md)
- [x] Critical evaluation of approaches (Critical_Evaluation.md)
- [x] This complete guide (PROJECT_COMPLETE_GUIDE.md)

---

## Current Status

### 🟢 Live Services
- ✅ **Backend Server**: Running on Render
  - Status: Live (verified `/api/health` responding July 12, 2026)
  - URL: https://pvz-backend-otiq.onrender.com
  - Health check: ✅ Responding
  - Game loop: ✅ Running (in-memory state only, no persistence)

- ⏳ **Database**: Supabase PostgreSQL
  - Status: Account/credentials configured, **not wired into backend code**
  - Nothing currently reads or writes to it

- ⏳ **Cache**: Upstash Redis
  - Status: Account/credentials configured, **not wired into backend code**

- ✅ **Deployment Pipeline**: GitHub → Render
  - Auto-deploy: Enabled
  - Branch: main
  - Trigger: Push to GitHub

- ✅ **Frontend**: Deployed to Vercel at https://pvz-frontend.vercel.app/

### 🟡 In Progress
- 📍 **Frontend**: Further along than previously documented
  - Folder structure: ✅ Ready
  - TypeScript config: ✅ Done (`vite.config.ts`, `tsconfig.json`)
  - React entry point (`main.tsx`/`App.tsx`): ✅ Built
  - Socket.io connection (`network.js`): ✅ Built, live-tested against backend
  - LobbyScene: ✅ Built (basic "waiting for room" screen)
  - GameScene: ✅ Built — renders towers/zombies from server state, click-to-place peashooter, demo mode for offline testing
  - Plant type selection UI: ⏳ Not built (only peashooter can be placed)
  - Zombie waves / combat: ⏳ Not built (backend has no combat system yet either)
  - Reconnect / opponent-disconnected UI: ⏳ Not built (backend doesn't send this event yet)

- 📍 A stray duplicate entry point (`frontend/src/main.js`, a vanilla-JS
  reimplementation of `App.tsx`) and its `styles.css` have been removed — they
  were dead code left over from an earlier approach and not referenced by
  `index.html`.

---

## Next Steps

The frontend scaffolding work originally scoped for "Week 1" is done. The real
gaps are game-logic depth and reliability features that exist on both the
backend and the docs as aspirations but not code:

### Immediate: Reconcile docs with reality
1. Backend claims persistence and reconnect handling that don't exist in code —
   either build them or stop claiming they're done (see `NETWORKING_CONTRACT_REVISED.md`
   for the full gap list).

### Next: Core gameplay
1. Implement zombie waves (currently one static zombie per room, never respawns)
2. Implement plant → zombie combat (zombies currently take no damage)
3. Add plant type selection (sunflower, wall-nut) in UI + `place_plant` payload
4. Add structured error feedback for failed placements (currently silently dropped)

### Then: Reliability
1. Add the 30-second reconnect grace period + `opponent_disconnected` messaging
2. Wire up Supabase for match persistence, or drop it from the stack if not needed for MVP
3. Interpolate zombie movement between ticks for smoother rendering

### Then: Polish & Launch
1. UI/UX pass on the live frontend (see UI/UX Review section below)
2. Bug fixes and playtesting with real players
3. Launch! 🚀

---

## Networking Contract

The frontend and backend communicate via Socket.io events, including a slot-based
`place_plant` (`{roomId, playerId, plant, slotIndex}`), a `state_update` broadcast
with the full 8-slot array plus zombies/sun/wave info, and a co-op `game_over`
(`{result: 'win'|'lose', reason}`). **Full event shapes, constants, and the
design-intent-vs-implemented gap list live in `NETWORKING_CONTRACT_REVISED.md`
— that file is the source of truth, this section intentionally doesn't duplicate
it anymore to avoid the two documents drifting out of sync again.**

---

## Development Roadmap

### Phase 1: Infrastructure (MOSTLY COMPLETE)
- ✅ GitHub repo set up
- ✅ Hosting accounts created (Vercel, Render, Supabase, Upstash)
- ✅ Backend server deployed and tested
- ✅ Environment variables configured
- ⏳ Database schema created but not connected to any backend code

### Phase 2: Frontend Scaffolding (DONE)
- ✅ Frontend folder structure ready
- ✅ TypeScript configs created
- ✅ Phaser initialized (GameScene; LobbyScene was removed and replaced with HTML menu/waiting screens)
- ✅ Socket.io connection tested against live backend

### Phase 3: Game Rendering (DONE)
- ✅ Lane/board rendering with 8 fixed slot markers
- ✅ Plant rendering (peashooter, sunflower sprites; wall-nut asset exists but unused — not in the current 2-plant scope)
- ✅ Zombie rendering
- ✅ HTML HUD (tick, wave status, per-player sun) and shop bar, not canvas-drawn text

### Phase 4: Real-time Sync (DONE)
- ✅ Socket.io event handlers
- ✅ State synchronization
- ✅ Shared-state visibility (via `state_update`)
- ⏳ Smooth animations — zombies currently snap to position each tick, no interpolation

### Phase 5: Game Logic (DONE — first pass)
- ✅ Peashooter cooldown-based combat against nearest zombie ahead
- ✅ Zombie chomp-on-contact damage to plants
- ✅ Wave scheduler (3 waves, escalating count and spawn rate)
- ✅ Co-op win/loss conditions (survive all waves vs. lawn breach)
- ✅ Plant placement validation (own-purse sun cost + slot occupancy)
- ⏳ Numbers are a first pass, not balanced — needs playtesting

### Phase 6: Polish & Launch (NOT STARTED)
- ⏳ Bug fixes
- ⏳ UI refinement (see UI/UX Review section)
- ⏳ Performance optimization
- ⏳ Playtesting
- ✅ Frontend already deployed to Vercel (production deployment exists, just incomplete)

---

## Setup Instructions

### For Your Friend (First Time Setup)

#### 1. Clone the Repository
```bash
git clone https://github.com/Goodmorningqwq/PVZ.git
cd PVZ
```

#### 2. Install Dependencies

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local
```

**Backend:**
```bash
cd ../backend
npm install
cp .env.example .env
```

#### 3. Configure Environment Variables

**Frontend (.env.local):**
```
VITE_BACKEND_URL=https://pvz-backend-otiq.onrender.com
VITE_LOG_LEVEL=debug
```

**Backend (.env):**
```
SUPABASE_URL=https://zvsctvjvijluwnoiheyr.supabase.co
SUPABASE_KEY=sb_publishable_mrR_Benklc9Zsnwc1MxTyA_YYFe_JtV
UPSTASH_REDIS_REST_URL=https://harmless-sculpin-147162.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAAj7aAAIgcDFiYzg1NThmZDk1YTg0NjA5YWYyZmI3NmNmZDNmM2M3Yg
PORT=3000
NODE_ENV=development
TICK_RATE=15
```

#### 4. Run Locally (Two Terminals)

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
# Output: http://localhost:5173
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
# Output: Server listening on port 3000
```

#### 5. Test Connection
- Open http://localhost:5173 in browser
- Check console (F12) for Socket.io connection message
- Should see: `✓ Connected to backend`

---

## Deployment Guide

### Frontend (Vercel)

1. Go to vercel.com
2. Import GitHub repo (PVZ)
3. Configure:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Install Command: `npm install`
4. Add Environment Variable:
   - Name: `VITE_BACKEND_URL`
   - Value: `https://pvz-backend-otiq.onrender.com`
5. Click Deploy
6. Wait 2-3 minutes
7. Get URL: `https://pvz-frontend-xxxxx.vercel.app`

### Backend (Already Deployed ✅)

Backend is already live at: https://pvz-backend-otiq.onrender.com

To redeploy after code changes:
```bash
git add .
git commit -m "Update backend code"
git push origin main
# Render auto-deploys in 2-3 minutes
```

---

## Important Files

### Configuration
- `frontend/package.json` - Frontend dependencies
- `frontend/.env.example` - Frontend env template
- `backend/package.json` - Backend dependencies
- `backend/.env.example` - Backend env template
- `backend/tsconfig.json` - TypeScript config
- `backend/src/index.ts` - Server entry point

### Documentation
- `FINAL_PROPOSAL.docx` - Complete technical specification
- `REPO_STRUCTURE.md` - Folder organization guide
- `NETWORKING_CONTRACT_REVISED.md` - Socket.io events spec
- `GETTING_STARTED.md` - Step-by-step setup
- `PROJECT_COMPLETE_GUIDE.md` - This file

### Source Code
- `frontend/src/` - Frontend React/Phaser code (to build)
- `backend/src/index.ts` - Backend server (COMPLETE)

---

## Common Commands

### Development
```bash
# Frontend
cd frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run type-check   # Check TypeScript

# Backend
cd backend
npm run dev          # Start with auto-restart
npm run build        # Compile TypeScript
npm run type-check   # Check TypeScript
```

### Git
```bash
git status           # Check what changed
git add .            # Stage all changes
git commit -m "msg"  # Commit
git push origin main # Push to GitHub
```

### Debugging
```bash
# Check backend logs
curl https://pvz-backend-otiq.onrender.com/api/health

# Check Render dashboard
https://render.com/dashboard

# Check Vercel dashboard
https://vercel.com/dashboard
```

---

## Troubleshooting

### Backend won't start
- Check environment variables in Render dashboard
- Verify Supabase and Upstash credentials are correct
- Check Render logs for error messages

### Frontend can't connect to backend
- Verify `VITE_BACKEND_URL` is set correctly
- Check backend is running (curl `/api/health`)
- Open browser console (F12) for Socket.io error messages

### TypeScript errors
- Run `npm install` to ensure all dependencies installed
- Check tsconfig.json matches backend/tsconfig.json
- Verify @types packages are in package.json

### Git push fails
- Run `git pull origin main` first
- Resolve any merge conflicts
- Then `git push origin main`

---

## Quick Reference

| What | URL | Status |
|------|-----|--------|
| GitHub Repo | https://github.com/Goodmorningqwq/PVZ | ✅ Live |
| Backend API | https://pvz-backend-otiq.onrender.com | ✅ Live (verified) |
| Frontend | https://pvz-frontend.vercel.app/ | ✅ Deployed, playable but incomplete (see UI/UX Review) |
| Render Dashboard | https://render.com/dashboard | ✅ Configured |
| Vercel Dashboard | https://vercel.com/dashboard | ✅ Ready |
| Supabase Console | https://supabase.com/dashboard | ⏳ Account exists, not wired into backend code |
| Upstash Console | https://console.upstash.com | ⏳ Account exists, not wired into backend code |

---

## UI/UX Review (Live Frontend)

Verified live at https://pvz-frontend.vercel.app/ via browser screenshot
(default lobby view and `?demo=1` game view). Confirms and extends the
code-based predictions from the earlier pass.

### Confirmed bugs (seen live, not just in code)

1. **Overlapping text in the HUD.** The multi-line status block
   ("Tick / Room / Player / Sun / mode", 5 lines) is drawn at a fixed
   position, and the hint text ("Click anywhere to request a peashooter
   placement.") is drawn 26px below the *start* of that block instead of
   below its end — the two literally overlap and are unreadable where they
   cross ("Room:" and "...where to request a peashooter placement." sit on
   the same line). Fix: compute the hint's y-position from the status
   block's actual rendered height, or move the hint to a fixed corner.

2. **Entities render outside the visible lane — a real coordinate-system
   bug, not just styling.** The lane background is drawn relative to the
   *current* canvas height (`height * 0.5`), which stretches to fill the
   window since the canvas uses `Phaser.Scale.RESIZE`. But entity positions
   (from `demoState` and from the backend's `state_update`) are fixed
   absolute pixels like `y: 180`, assuming a small fixed-size board. On a
   normal laptop window, the lane renders around the vertical middle of the
   screen while all plants/zombies render up near the top — completely
   detached from the lane they're supposedly standing in. I confirmed this
   by clicking to place a new plant: the new plant appeared exactly at the
   click position (inside the lane, using pointer coordinates), while the
   three original demo entities stayed stuck near the top-left, nowhere
   near the lane. **This will look broken in every real game, not just
   demo mode**, since the backend sends the same kind of fixed pixel
   coordinates. Needs a proper coordinate system (e.g., a fixed logical
   game resolution like 800×400 scaled/letterboxed into the viewport,
   rather than absolute pixels matched against a resized canvas).

3. **Low-contrast header text.** "Demo mode • Player ..." and "Status: ..."
   render in a dark gray-blue on the purple/blue gradient background —
   confirmed hard to read at a glance, consistent with the "`App.css` styles
   nothing that exists" finding below.

### Confirmed issues (found in code, consistent with what's on screen)

4. **`App.css` is stale and styles nothing that exists.** It defines rules
   for `.container`, `.status`, `.links`, `.next-steps` — leftover from an
   earlier placeholder landing page. The actual JSX in `App.tsx` uses
   `.app-shell`, `.app-header`, `.game-canvas`, none of which have any CSS
   rules — which is exactly why the header renders as plain unstyled text.

5. **Global body styling fights the full-screen game canvas.** `global.css`
   sets `body` to a purple gradient with
   `display: flex; justify-content: center; align-items: center` — styling
   meant for a centered marketing card, not a full-viewport game. Combined
   with bug #2 above, this compounds the "nothing lines up" feeling.

6. **No visual distinction between demo mode and live mode beyond a text
   string** buried in the same small HUD block that's already overlapping
   (bug #1).

7. **No loading/connecting state beyond plain text.** "Connecting..." is
   just a text string with no spinner — on Render's free tier the backend
   can take 30+ seconds to wake from a cold start, and a bare text line is
   easy to mistake for the app being broken.

8. **No error state for connection failure**, and **no sun-cost/afford-
   ability feedback** before placement, and **no room-code sharing UI**
   (starting a match currently requires manually constructing a `?room=`
   URL) — all still true as originally noted.

### Fixed in this pass (July 12, 2026)

The three highest-priority items above have been implemented in the frontend
source (not yet deployed — needs `git push` + Vercel redeploy to go live):

- **Coordinate system:** added `GAME_WIDTH`/`GAME_HEIGHT` (800×400) constants
  matching the values already documented in `NETWORKING_CONTRACT_REVISED.md`,
  and switched the Phaser scale mode from `RESIZE` to `FIT` with
  `autoCenter: CENTER_BOTH` (`frontend/src/App.tsx`). Entity coordinates from
  the backend now land inside the lane at any window size instead of floating
  near the top-left.
- **HUD overlap:** removed the canvas-drawn `staticText`/`hintText` from
  `GameScene.js` entirely; the scene now emits a `hud-update` event that
  `App.tsx` listens to and renders as a real HTML/CSS overlay
  (`.hud-overlay`, `.hud-hint`, `.mode-badge`), so status text can't collide
  anymore.
- **Stale CSS / body-canvas conflict:** rewrote `App.css` (removed the
  leftover landing-page rules, added real styles for `.app-shell`,
  `.app-header`, `.game-stage`, `.game-canvas`) and removed the body-level
  flex-centering in `global.css` that was fighting the game canvas.

Not yet done: lobby/connection states (spinner, cold-start message, retry),
room-code sharing UI, sun-cost/affordability feedback, and rejected-placement
toasts — still tracked as Phases 3–4 above.

**Note on verification:** I couldn't run a full `npm run build` in this
session — `npm install` repeatedly timed out in the sandbox (network/proxy
issue, not a code issue). I verified correctness by hand: read every changed
file back, confirmed brace/bracket balance, and ran `node --check` on the
plain-JS files. I also caught and fixed a real bug in the process — two of
the edited files (`App.css`, `GameScene.js`) ended up with stray trailing
null bytes after in-place edits shrank them below their original size (a
quirk of this sandbox's file mount, not a code logic issue); both were
cleaned up and re-verified. Recommend running `npm run build` locally or
letting Vercel's build step catch anything before merging.

### Suggested improvements, roughly in priority order

1. Fix the coordinate system (#2) — this is the highest-impact bug since it
   makes the actual game look broken, not just the lobby screen.
2. Fix HUD text overlap (#1) and move status/hint text out of Phaser canvas
   text into a proper HTML/CSS overlay (styled, positioned independent of
   canvas redraws).
3. Replace `App.css`'s leftover landing-page styles with real rules for
   `.app-shell` / `.app-header` / `.game-canvas`, and stop the body from
   flex-centering a full-viewport canvas.
4. Add a "Creating room..." / "Waiting for opponent..." screen with a
   spinner and copyable invite link, replacing the current bare-text lobby
   message.
5. Add a visible sun-cost badge before placement and a rejected-placement
   flash/toast once the backend supports `action_rejected`.
6. Add a connection-timeout message acknowledging Render free-tier cold
   starts, and a real error state if the socket never connects.
7. Give demo vs. live mode a clear visual treatment (banner/badge) instead
   of burying it in overlapping status text.

---

## Contact & Questions

If your friend has questions:
1. Check the README in each folder
2. Read NETWORKING_CONTRACT_REVISED.md for Socket.io details
3. Check GETTING_STARTED.md for setup help
4. Read error messages carefully - they usually tell you what's wrong

---

## Summary for Your Friend

**Hi! Welcome to the project.** 👋

Update: the frontend scaffolding this section used to assign as "your job" is
already done — LobbyScene, GameScene, Socket.io wiring, and a live Vercel
deployment all exist. What's actually left is game-logic depth and reliability
work, split between backend and frontend.

**What's already done:**
- Backend live and tested (in-memory only, no persistence yet)
- Frontend built and deployed: lobby, game rendering, click-to-place, demo mode
- Real-time sync working end-to-end against the live backend

**What's next (see "Next Steps" above for the full breakdown):**
1. Zombie waves + plant/zombie combat (currently: one zombie, no combat)
2. Plant type selection (currently: peashooter only)
3. Reconnect grace period + disconnect messaging (currently: none)
4. Wire up Supabase or drop it from the stack
5. UI/UX polish pass (see UI/UX Review section)

The networking contract (NETWORKING_CONTRACT_REVISED.md) has been corrected to
describe what's actually implemented, not the original aspirational design —
read it before adding new socket events so you don't build against events that
don't exist.

**Let's ship! 🚀**

---

**Created:** July 12, 2026 (content reconciled against actual repo same day)
**Backend Status:** ✅ Live, ⚠️ no persistence, ⚠️ no reconnect handling
**Frontend Status:** 🟡 Core scaffolding + rendering done, game logic and polish remaining
**Overall Progress:** Phase 1 (Infrastructure) mostly done | Phases 2-4 (Frontend scaffolding, rendering, sync) done | Phases 5-6 (Game logic, polish) not started
