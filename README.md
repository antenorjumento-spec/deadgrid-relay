# DEADGRID public relay server

This small Node.js TCP relay lets DEADGRID clients create/join rooms from different networks. It relays player snapshots only; it does not authoritatively simulate zombies, bosses, loot, or shared combat.

## Deploy with Railway (raw TCP)

1. Upload the **contents of this folder** to a GitHub repository (so `Dockerfile` and `server.js` are at repository root).
2. In Railway, create a project and deploy the repository. Railway should detect the Dockerfile.
3. In the service Variables, set `HOST=0.0.0.0` and `PORT=27878`.
4. Deploy and check the logs; the service should print `DEADGRID relay listening on 0.0.0.0:27878`.
5. In the service Settings → Networking → TCP Proxy, expose internal TCP port `27878`. Railway will issue a public host and a public port.
6. In each DEADGRID client, enter the exact public endpoint `host:port` shown by Railway (do not assume the external port is 27878). All players must use the same endpoint.
7. One player creates a room and shares its generated room code. Friends enter that endpoint and code, then join.

## Cost and access

Railway supports TCP Proxy, but access to public networking can depend on the account/trial status and plan. Check the current billing page before deploying. If payment or account verification is requested, pause and ask a parent/guardian to help; do not enter payment details without their permission.

## Local testing

Requires Node.js 20+; there are no npm packages.

```bash
node server.js
```

By default, listens on `0.0.0.0:27878`. Local clients can use `127.0.0.1:27878` only when they are running on the same computer as this server.

## Important limits

- This server uses plain TCP, without TLS or user accounts; intended for testing with trusted friends only.
- Room codes should only be shared with people you trust.
- It syncs player presence/position/aim/weapon/avatar/name only. Game enemies, loot, missions, and combat are not yet shared authoritative state.
- For a public release, add a secure transport, connection/room rate limits, abuse controls, and server-authoritative game simulation.
