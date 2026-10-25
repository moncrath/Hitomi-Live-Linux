import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

// Localhost-only: hook Claude Code POST /event -> broadcast ke overlay via WS /ws.
const HOST = '127.0.0.1';
const PORT = Number(process.env.HITOMI_BRIDGE_PORT ?? 17872);
const MAX_NAME = 48;
const MAX_BODY = 1024;

interface Signal {
  kind: 'event' | 'state';
  name: string;
}

/** Validasi ketat: cegah payload sembarang (bridge cuma me-relay NAMA, tak eksekusi apa pun). */
function parseSignal(body: unknown): Signal | null {
  if (typeof body !== 'object' || body === null) return null;
  const { kind, name } = body as Record<string, unknown>;
  if (kind !== 'event' && kind !== 'state') return null;
  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_NAME) return null;
  if (!/^[A-Za-z0-9_]+$/.test(name)) return null;
  return { kind, name };
}

const clients = new Set<WebSocket>();

function broadcast(sig: Signal): void {
  const msg = JSON.stringify(sig);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // localhost-only; dampak cuma animasi
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: clients.size }));
    return;
  }

  if (req.method === 'POST' && req.url === '/event') {
    let raw = '';
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
      if (raw.length > MAX_BODY) {
        aborted = true;
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });
    req.on('end', () => {
      if (aborted) return;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const sig = parseSignal(parsed);
      if (!sig) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid signal' }));
        return;
      }
      broadcast(sig);
      console.log(`[bridge] ${sig.kind}:${sig.name} -> ${clients.size} client`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[bridge] overlay connect (${clients.size})`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[bridge] overlay disconnect (${clients.size})`);
  });
  ws.on('error', () => {
    clients.delete(ws);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[bridge] siap di http://${HOST}:${PORT}  (POST /event, WS /ws)`);
});
