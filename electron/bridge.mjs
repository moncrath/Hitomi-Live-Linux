// Bridge in-process untuk shell Electron. Kontraknya IDENTIK dengan versi Rust
// (`app/src-tauri/src/lib.rs`): hook Claude Code POST {kind,name} ke /event atau
// {text} ke /bubble, lalu diteruskan ke webview. Relay-nama murni + validasi
// ketat, TAK PERNAH mengeksekusi apa pun. Ubah salah satu → ubah keduanya.

import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 17872;
const MAX_NAME = 48;
const MAX_BODY = 1024;
const MAX_BUBBLE_BODY = 4096;
const MAX_BUBBLE_TEXT = 600;

const parseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const validName = (name) =>
  typeof name === 'string' && name.length > 0 && name.length <= MAX_NAME && /^[A-Za-z0-9_]+$/.test(name);

export function parseSignal(raw) {
  const v = parseJson(raw);
  if (!v || (v.kind !== 'event' && v.kind !== 'state') || !validName(v.name)) return null;
  return { kind: v.kind, name: v.name };
}

export function parseBubble(raw) {
  const v = parseJson(raw);
  const text = typeof v?.text === 'string' ? v.text.trim() : '';
  // Potong per code point (bukan code unit) supaya emoji tak terbelah, sama seperti Rust.
  return text ? Array.from(text).slice(0, MAX_BUBBLE_TEXT).join('') : null;
}

/** Baca body dengan batas. Mengembalikan null bila melebihi `cap` (→ 413). */
function readCapped(req, cap) {
  return new Promise((resolve) => {
    let body = '';
    let over = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (over) return;
      body += chunk;
      if (Buffer.byteLength(body) > cap) over = true;
    });
    req.on('end', () => resolve(over ? null : body));
    req.on('error', () => resolve(null));
  });
}

const reply = (res, status, body = '') => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
};

/**
 * Mulai listener. `emit(event, payload)` meneruskan ke webview.
 * Retry bind: instance lama bisa masih memegang port sebentar saat restart.
 */
export function startBridge(emit, attempt = 1) {
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') return reply(res, 200, '{"ok":true}');
    const routes = {
      '/event': { cap: MAX_BODY, parse: parseSignal, event: 'signal', wrap: (s) => s },
      '/bubble': { cap: MAX_BUBBLE_BODY, parse: parseBubble, event: 'bubble', wrap: (text) => ({ text }) },
    };
    const route = req.method === 'POST' ? routes[req.url] : undefined;
    if (!route) return reply(res, 404);
    const body = await readCapped(req, route.cap);
    if (body === null) return reply(res, 413);
    const parsed = route.parse(body);
    if (parsed === null) return reply(res, 400, '{"ok":false}');
    emit(route.event, route.wrap(parsed));
    reply(res, 200, '{"ok":true}');
  });
  server.on('error', (e) => {
    if (attempt >= 10) return console.error(`[bridge] menyerah listen ${HOST}:${PORT}: ${e.message}`);
    console.warn(`[bridge] listen gagal (coba ${attempt}/10): ${e.message}`);
    setTimeout(() => startBridge(emit, attempt + 1), 400);
  });
  server.listen(PORT, HOST, () => console.info(`[bridge] siap di http://${HOST}:${PORT}`));
}
