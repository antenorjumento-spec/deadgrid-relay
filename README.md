# DEADGRID relay 1.8.4 — room capacities 2–8

Publish this server to your existing GitHub repository connected to Railway. Replace the repository-root `server.js` with this one, commit changes, and wait for Railway to redeploy. Keep the existing root Dockerfile and TCP Proxy. Internal port remains 27878.

Deploy Logs should show `DEADGRID relay room-capacity v1.8.4` and `DEADGRID relay listening on 0.0.0.0:27878`.

Room protocol:
- CREATE: `CREATE|nickname|avatar|maxPlayers`
- JOIN: `JOIN|roomCode|nickname|avatar`
- WELCOME: `W|roomCode|id|seed|isOwner|maxPlayers`

The relay validates capacity 2–8 (default 4 for old clients), enforces room-specific capacity, and returns `E|ROOM_FULL` when no slots remain. Room code normalization accepting codes with or without hyphen is preserved.
