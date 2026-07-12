# Getting Started - Multiplayer PvZ

Complete setup guide to get the project running locally and deployed to production.

---

## STEP 1: Initialize Git & GitHub

```bash
cd /path/to/game
git init
git add .
git commit -m "Initial commit: folder structure + config"
git branch -M main
# Create new GitHub repo, then:
git remote add origin https://github.com/yourusername/pvz-multiplayer.git
git push -u origin main
```

---

## STEP 2: Set Up Hosting Accounts (5 minutes each)

### Vercel (Frontend)
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. No setup needed yet (will import repo later)

### Render (Backend)
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. No setup needed yet (will import repo later)

### Supabase (Database)
1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub
3. Create new project:
   - Name: `pvz-multiplayer`
   - Region: Pick closest to you
   - Password: Store securely
4. Wait 2-3 minutes for database to initialize
5. Go to **Settings → API**:
   - Copy `Project URL`
   - Copy `anon public` key
6. Save these in a secure place (you'll need them soon)

### Upstash (Redis)
1. Go to [upstash.com](https://upstash.com)
2. Sign up with GitHub
3. Create new Redis database:
   - Name: `pvz-queue`
   - Region: Pick closest to you
4. Wait 1 minute for creation
5. Go to **Details**:
   - Copy `UPSTASH_REDIS_REST_URL`
   - Copy `UPSTASH_REDIS_REST_TOKEN`
6. Save these

---

## STEP 3: Set Up Supabase Database Schema

### Create Tables via SQL
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy & run this SQL:

```sql
-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  username VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id UUID REFERENCES players(id),
  player_b_id UUID REFERENCES players(id),
  winner_id UUID REFERENCES players(id),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  final_wave INT DEFAULT 0,
  duration_seconds INT
);

-- Game events table (for replay/analytics)
CREATE TABLE IF NOT EXISTS game_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID REFERENCES matches(id),
  player_id UUID REFERENCES players(id),
  event_type VARCHAR(50), -- 'place_plant', 'remove_plant'
  plant_type VARCHAR(50),
  tile_x INT,
  tile_y INT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security (for future auth)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
```

4. Click **Run** ✓

---

## STEP 4: Local Development Setup

### Clone & Install Dependencies

```bash
cd /path/to/game

# Frontend setup
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local if needed (localhost:3000 by default)

# Backend setup
cd ../backend
npm install
cp .env.example .env
```

### Edit Backend .env

Open `backend/.env` and fill in:

```
SUPABASE_URL=https://xxxxx.supabase.co    # From Supabase
SUPABASE_KEY=eyJxxx...                     # From Supabase
UPSTASH_URL=https://xxxxx.upstash.io      # From Upstash
UPSTASH_TOKEN=xxxxx                        # From Upstash
PORT=3000
NODE_ENV=development
```

---

## STEP 5: Run Locally

Open **two terminals**:

### Terminal 1: Frontend
```bash
cd frontend
npm run dev
# Output: ➜  Local:   http://localhost:5173/
```

### Terminal 2: Backend
```bash
cd backend
npm run dev
# Output: Server listening on port 3000
```

### Test Connection
1. Open http://localhost:5173 in browser
2. Open browser console (F12)
3. Should see: `✓ Socket connected`
4. If errors, check .env files

---

## STEP 6: Deploy to Production (Vercel + Render)

### 6.1 Deploy Frontend to Vercel

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

1. Go to [vercel.com](https://vercel.com/dashboard)
2. Click **Add New → Project**
3. Import your GitHub repo
4. Vercel auto-configures Vite projects
5. Click **Deploy**
6. Wait 2 minutes, get your URL: `pvz-multiplayer-xxxxx.vercel.app`

### 6.2 Deploy Backend to Render

1. Go to [render.com](https://render.com/dashboard)
2. Click **New +** → **Web Service**
3. Select your GitHub repo
4. Configure:
   - **Name**: `pvz-multiplayer-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run build && npm start`
5. Click **Advanced**:
   - Add environment variables from your `.env`:
     ```
     SUPABASE_URL = https://xxxxx.supabase.co
     SUPABASE_KEY = eyJxxx...
     UPSTASH_URL = https://xxxxx.upstash.io
     UPSTASH_TOKEN = xxxxx
     PORT = 3000
     NODE_ENV = production
     ```
6. Click **Create Web Service**
7. Wait 3-5 minutes, get your URL: `pvz-multiplayer-backend.onrender.com`

### 6.3 Update Frontend with Backend URL

1. Edit `frontend/.env.example`:
   ```
   VITE_BACKEND_URL=https://pvz-multiplayer-backend.onrender.com
   ```

2. Commit & push:
   ```bash
   git add frontend/.env.example
   git commit -m "Update backend URL for production"
   git push origin main
   ```

3. Vercel auto-redeploys (~1 minute)

### 6.4 Set Up Keep-Alive (Prevent Render Cold Starts)

1. In Upstash dashboard:
   - Go to your Redis database
   - Click **Details** → **REST API**
   - Create a new Webhook:
     - **URL**: `https://pvz-multiplayer-backend.onrender.com/api/health`
     - **Trigger**: Every 14 minutes
     - **Request Method**: GET

2. Click **Create**

Now Render will stay warm and respond within seconds!

---

## STEP 7: Verify Production Deployment

1. Open `https://pvz-multiplayer-xxxxx.vercel.app` (your Vercel URL)
2. Browser console should show: `✓ Socket connected to https://pvz-multiplayer-backend.onrender.com`
3. Try creating a room: Share the link
4. Test with a second browser tab

---

## File Checklist

After completing all steps, you should have:

```
game/
├── .gitignore
├── frontend/
│   ├── package.json
│   ├── .env.example
│   ├── vite.config.ts      (TODO: create)
│   ├── tsconfig.json       (TODO: create)
│   ├── index.html          (TODO: create)
│   └── src/
│       ├── main.tsx        (TODO: create)
│       ├── App.tsx         (TODO: create)
│       └── ...
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── tsconfig.json       (TODO: create)
│   └── src/
│       ├── index.ts        (TODO: create)
│       └── ...
└── docs/
    └── DEPLOYMENT.md       (TODO: detailed guide)
```

---

## Next Steps (Week 1)

1. ✅ Complete this setup guide
2. Create `frontend/vite.config.ts` (Vite configuration)
3. Create `frontend/index.html` (Entry HTML)
4. Create `backend/src/index.ts` (Express server)
5. Create Socket.io connection handlers
6. Test locally with `npm run dev` in both folders
7. Deploy both to production

---

## Troubleshooting

### "Cannot find module" errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Connection refused" on localhost
- Check backend is running on port 3000
- Check frontend is running on port 5173
- Check both are on same machine

### Supabase connection fails
- Verify `.env` has correct SUPABASE_URL and SUPABASE_KEY
- Check Supabase project is active (not paused)

### Render deployment fails
- Check all env vars are set in Render dashboard
- Check `npm start` works locally: `npm run build && npm start`
- View build logs in Render dashboard

---

## Quick Reference

| What | URL |
|------|-----|
| Frontend (local) | http://localhost:5173 |
| Frontend (prod) | https://pvz-multiplayer-xxxxx.vercel.app |
| Backend (local) | http://localhost:3000 |
| Backend (prod) | https://pvz-multiplayer-backend.onrender.com |
| Supabase | https://supabase.com/dashboard |
| Render | https://render.com/dashboard |
| Upstash | https://console.upstash.com |

---

## Questions?

Refer to:
- `FINAL_PROPOSAL.md` - Full technical specification
- `REPO_STRUCTURE.md` - Folder organization
- `docs/DEPLOYMENT.md` - Detailed deployment guide (create after Step 7)
