# Plants vs Zombies Multiplayer Frontend

This repository contains the frontend renderer for a multiplayer Plants vs Zombies web game.

It is intentionally thin: Phaser 3 renders the scene, socket.io-client sends player intent, and the server remains the source of truth for all gameplay state.

## Networking Contract

The frontend treats the server as the only source of truth and expects these Socket.io events:

- `join_room`: `{ roomId, playerId }`
- `place_plant`: `{ roomId, playerId, x, y }`
- `room_joined`: `{ roomId, playerId, opponentId }`
- `state_update`: `{ tick, towers, zombies, sun }`
- `game_over`: `{ winnerId, reason }`

All IDs are strings, coordinates are numbers, and `state_update` always contains every field even when arrays or maps are empty.

## Local Development

1. Install dependencies:

   `npm install`

2. Start the dev server:

   `npm run dev`

3. Open the app with a room code in the query string, for example:

   `http://localhost:5173/?room=abc123`

The frontend expects a separate backend server to be running. Set `VITE_BACKEND_URL` in `.env.local` if your server is not at `http://localhost:3000`.

Backend repo placeholder: `<backend-repo-url>`