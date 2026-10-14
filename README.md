# DEADGRID relay diagnostic build v1.8.2

This is a diagnostic variant of the same TCP relay protocol. It logs whether clients send `CREATE` or `JOIN`, and logs each successful room code (but no passwords/tokens are handled). This helps diagnose why a Create Room click gets `ROOM_NOT_FOUND`.

## Redeploy on Railway
1. Replace `server.js` and `Dockerfile` in the existing GitHub repository with these files (keep both in repository root).
2. Commit the change, then trigger or wait for Railway to redeploy the same service. Keep `HOST=0.0.0.0` and `PORT=27878`.
3. Keep the existing TCP Proxy. You usually do not need to create another one if the service/proxy are unchanged.
4. In Logs, expect `DEADGRID relay diagnostic build v1.8.2`. Click Create Room in the game.

## Interpret logs
- `[HANDSHAKE] command=CREATE ...` followed by `[ROOM] CREATED code=DG-...`: client created a room successfully. If game still reports an error, the client may be showing stale status or the handshake response parser is wrong.
- `[HANDSHAKE] command=JOIN ...` when you click Create: installed client is sending JOIN or the UI click is routed to Join; rebuild/update the client from matching source.
- `JOIN failed; code not found`: expected only when a player attempts to join a room code that is not currently active.
- No `[HANDSHAKE]` line: client did not reach this service/port or did not send a complete line.

This relay synchronizes basic player snapshots only. It is not an authoritative game server and has no TLS/authentication; use for trusted playtests, not public production.
