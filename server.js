'use strict';
// DEADGRID Internet relay v1.8.4. Supports selectable room capacity (2-8 players).
// This service relays player state only; clients still simulate their own zombie worlds.
const net = require('node:net');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 27878);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PLAYERS = 8; // absolute server safety cap; each room chooses 2-8
const MAX_LINE = 4096;
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function roomCode() {
  let code;
  do {
    let s = 'DG-';
    for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
    code = s;
  } while (rooms.has(code));
  return code;
}
function safeName(name) {
  const s = String(name || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
  return s || 'SURVIVOR';
}
function intIn(v, min, max, fallback) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
function numberIn(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}
function writeLine(socket, line) {
  if (socket.destroyed || !socket.writable) return;
  if (socket.writableLength > 256 * 1024) { socket.destroy(); return; }
  socket.write(line + '\n');
}
function stateRecord(p) {
  const s = p.state;
  return [p.id, s.x, s.y, s.hp, s.aimX, s.aimY, s.weapon, s.alive ? 1 : 0, s.shotSerial, p.avatar, p.name].join(',');
}
function snapshot(room) {
  return `S|${room.seed}|${[...room.players.values()].map(stateRecord).join(';')}`;
}
function broadcast(room) {
  if (!room || room.players.size === 0) return;
  const packet = snapshot(room);
  for (const p of room.players.values()) writeLine(p.socket, packet);
}
function removePlayer(socket) {
  const room = socket.room;
  if (!room || !socket.player) return;
  const leavingId = socket.player.id;
  room.players.delete(leavingId);
  socket.room = null;
  socket.player = null;
  if (room.ownerId === leavingId && room.players.size > 0) {
    room.ownerId = room.players.keys().next().value;
    const newOwner = room.players.get(room.ownerId);
    if (newOwner) newOwner.isOwner = true;
  }
  if (room.players.size === 0) rooms.delete(room.code);
  else broadcast(room);
}
function attachPlayer(socket, room, name, avatar) {
  if (room.players.size >= Math.min(room.maxPlayers, MAX_PLAYERS)) { writeLine(socket, 'E|ROOM_FULL'); socket.end(); return; }
  let id = room.nextId++;
  const p = {
    id, name: safeName(name), avatar: intIn(avatar, 0, 7, 0), socket,
    isOwner: room.players.size === 0,
    state: { x: 640, y: 590, hp: 100, aimX: 1, aimY: 0, weapon: 0, alive: true, shotSerial: 0 }
  };
  if (p.isOwner) room.ownerId = id;
  room.players.set(id, p);
  socket.room = room;
  socket.player = p;
  writeLine(socket, `W|${room.code}|${id}|${room.seed}|${p.isOwner ? 1 : 0}|${room.maxPlayers}`);
  broadcast(room);
}
function handleHello(socket, line) {
  const f = line.split('|');
  console.log(`[HANDSHAKE] command=${f[0] || '(empty)'} fields=${f.length} remote=${socket.remoteAddress || '?'}:${socket.remotePort || '?'}`);
  if (f[0] === 'CREATE' && f.length >= 3) {
    const capacity = intIn(f[3], 2, 8, 4); // old clients without capacity retain the 4-player default
    console.log(`[ROOM] CREATE requested name=${safeName(f[1])} avatar=${intIn(f[2], 0, 7, 0)} capacity=${capacity}`);
    if (rooms.size >= 10000) { writeLine(socket, 'E|SERVER_ROOM_LIMIT'); socket.end(); return; }
    const room = { code: roomCode(), seed: crypto.randomBytes(4).readUInt32LE(0) || 0xD34D6120, players: new Map(), nextId: 0, ownerId: -1, maxPlayers: capacity };
    rooms.set(room.code, room);
    attachPlayer(socket, room, f[1], f[2]);
    console.log(`[ROOM] CREATED code=${room.code} players=${room.players.size}/${room.maxPlayers}`);
    return;
  }
  if (f[0] === 'JOIN' && f.length >= 4) {
    // Normalize room codes so both 'DG-ABC123' and 'DGABC123' work.
    // The room map stores canonical codes in the form 'DG-XXXXXX'.
    const receivedCode = String(f[1]);
    const compactCode = receivedCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = compactCode.length === 8 && compactCode.startsWith('DG')
      ? `${compactCode.slice(0, 2)}-${compactCode.slice(2)}`
      : compactCode;
    const room = rooms.get(code);
    console.log(`[ROOM] JOIN requested received=${JSON.stringify(receivedCode)} canonical=${code} name=${safeName(f[2])}`);
    if (!room) { console.warn(`[ROOM] JOIN failed; code not found: ${code}`); writeLine(socket, 'E|ROOM_NOT_FOUND'); socket.end(); return; }
    if (room.players.size >= room.maxPlayers) { console.warn(`[ROOM] JOIN failed; room full ${code} ${room.players.size}/${room.maxPlayers}`); writeLine(socket, 'E|ROOM_FULL'); socket.end(); return; }
    attachPlayer(socket, room, f[2], f[3]);
    return;
  }
  writeLine(socket, 'E|BAD_HANDSHAKE');
  socket.destroy();
}
function handleState(socket, line) {
  const room = socket.room, player = socket.player;
  if (!room || !player) { handleHello(socket, line); return; }
  if (line === 'Q' || line === 'QUIT') { socket.end(); return; }
  if (!line.startsWith('P|')) return;
  const f = line.slice(2).split('|');
  if (f.length < 8) return;
  const prev = player.state;
  player.state = {
    x: numberIn(f[0], -100000, 100000, prev.x),
    y: numberIn(f[1], -100000, 100000, prev.y),
    hp: numberIn(f[2], 0, 100000, prev.hp),
    aimX: numberIn(f[3], -1.01, 1.01, prev.aimX),
    aimY: numberIn(f[4], -1.01, 1.01, prev.aimY),
    weapon: intIn(f[5], 0, 32, prev.weapon),
    alive: f[6] === '1',
    shotSerial: intIn(f[7], 0, 2147483647, prev.shotSerial)
  };
}
const server = net.createServer({ allowHalfOpen: false }, (socket) => {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 15000);
  socket.setTimeout(45000, () => socket.destroy());
  socket.buffer = '';
  socket.room = null;
  socket.player = null;
  socket.on('data', (chunk) => {
    socket.buffer += chunk.toString('utf8');
    if (socket.buffer.length > MAX_LINE) { socket.destroy(); return; }
    let i;
    while ((i = socket.buffer.indexOf('\n')) >= 0) {
      const line = socket.buffer.slice(0, i).replace(/\r$/, '');
      socket.buffer = socket.buffer.slice(i + 1);
      if (!line) continue;
      if (!socket.player) handleHello(socket, line);
      else handleState(socket, line);
      if (socket.destroyed) break;
    }
  });
  socket.on('error', () => {});
  socket.on('close', () => removePlayer(socket));
});
const ticker = setInterval(() => { for (const room of rooms.values()) broadcast(room); }, 80);
server.on('error', (err) => { console.error('Relay server error:', err.message); process.exitCode = 1; });
server.listen(PORT, HOST, () => {
  console.log('DEADGRID relay room-capacity v1.8.4');
  console.log(`DEADGRID relay listening on ${HOST}:${PORT}`);
  console.log('Players connect outbound to this server; no router port-forwarding on phones is needed.');
});
function shutdown() { clearInterval(ticker); server.close(() => process.exit(0)); for (const room of rooms.values()) for (const p of room.players.values()) p.socket.destroy(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
