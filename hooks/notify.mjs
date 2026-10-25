#!/usr/bin/env node
// Hook Claude Code -> POST event ke bridge Hitomi (in-process di overlay).
// Dipakai dari settings: node hooks/notify.mjs PreToolUse
// Pada Stop: juga baca transkrip .jsonl -> kalimat terakhir Hitomi -> POST /bubble.
//
// Prinsip: FIRE-AND-FORGET. Cepat, timeout pendek, SELALU exit 0 —
// jangan pernah blokir/gagalkan Claude Code walau bridge mati.

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BRIDGE = process.env.HITOMI_BRIDGE_URL ?? 'http://127.0.0.1:17872';
const STREAK_FILE = join(tmpdir(), 'hitomi-errstreak.json');

// Peta nama hook Claude Code -> nama event manifest overlay.
const EVENT_MAP = {
  SessionStart: 'SessionStart',
  UserPromptSubmit: 'UserPromptSubmit',
  PreToolUse: 'PreToolUse',
  PostToolUse: 'PostToolUse',
  Notification: 'Notification',
  Stop: 'Stop',
  SubagentStop: 'Stop',
};

function readStdin(timeoutMs = 200) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(data);
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => {
      data += c;
      if (data.length > 262144) finish();
    });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, timeoutMs);
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function post(path, body) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 400);
  return fetch(BRIDGE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ac.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(t));
}

/** True bila hasil tool (payload PostToolUse) menandakan error. Best-effort (bentuk bervariasi). */
function toolErrored(hook) {
  const r = hook?.tool_response;
  if (r == null) return false;
  if (typeof r === 'object') {
    if (r.is_error === true || r.success === false) return true;
    if (r.error != null && r.error !== '') return true;
    try {
      if (/"is_error"\s*:\s*true/.test(JSON.stringify(r))) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Hitung error beruntun (persisten antar-proses hook via file tmp). Reset bila jeda >2 menit. */
function bumpStreak(isError) {
  let s = { n: 0, t: 0 };
  try {
    s = JSON.parse(readFileSync(STREAK_FILE, 'utf8'));
  } catch {
    /* belum ada */
  }
  const now = Date.now();
  if (now - (s.t || 0) > 120000) s.n = 0;
  s.n = isError ? (s.n || 0) + 1 : 0;
  s.t = now;
  try {
    writeFileSync(STREAK_FILE, JSON.stringify(s));
  } catch {
    /* abaikan */
  }
  return s.n;
}

/** Ambil kalimat terakhir "Hitomi" (assistant terakhir yang ada teksnya) dari transkrip. */
function extractBubble(transcriptPath) {
  try {
    const st = statSync(transcriptPath);
    if (!st.isFile() || st.size > 25 * 1024 * 1024) return null;
    const lines = readFileSync(transcriptPath, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      const o = parseJson(line);
      const msg = o?.message;
      if (!msg || msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
      const text = msg.content
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join(' ')
        .trim();
      if (!text) continue;
      return cleanSentence(text);
    }
  } catch {
    /* transkrip tak terbaca -> tanpa bubble */
  }
  return null;
}

/** Bersihkan markdown ringan + ambil kalimat terakhir, batasi panjang. */
function cleanSentence(raw) {
  const t = raw
    .replace(/```[\s\S]*?```/g, ' ') // blok kode
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // link -> teks
    .replace(/[*_#>]/g, '') // penekanan/heading md
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  const parts = t.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let s = parts.length ? parts[parts.length - 1] : t;
  if (s.length > 180) s = s.slice(0, 180).trim() + '…';
  return s;
}

async function main() {
  const argvName = process.argv[2];
  let name = argvName;
  let hook = null;

  // Baca stdin bila perlu: untuk ambil nama (fallback), transcript_path (Stop),
  // atau tool_response (PostToolUse -> deteksi error). Hook lain: jalur cepat.
  const needStdin = !name || name === 'Stop' || name === 'PostToolUse';
  if (needStdin) {
    hook = parseJson(await readStdin());
    if (!name) name = hook?.hook_event_name ?? hook?.hookEventName;
  }

  const mapped = name && EVENT_MAP[name];
  if (!mapped) return;

  const tasks = [post('/event', { kind: 'event', name: mapped })];

  // PostToolUse: deteksi error -> mood dizzy (sesekali) / marah (beruntun >=3x).
  if (name === 'PostToolUse') {
    const streak = bumpStreak(toolErrored(hook));
    if (streak > 0) {
      const mood = streak >= 3 ? 'error_streak' : 'coding_error';
      tasks.push(post('/event', { kind: 'event', name: mood }));
    }
  }

  // Stop asli: bubble kalimat terakhir Hitomi.
  if (name === 'Stop') {
    const path = hook?.transcript_path ?? hook?.transcriptPath;
    if (path) {
      const text = extractBubble(path);
      if (text) tasks.push(post('/bubble', { text }));
    }
  }

  await Promise.all(tasks);
}

main().finally(() => process.exit(0));
