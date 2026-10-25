// Pemasang hook otomatis untuk shell Electron. Port setia dari
// `app/src-tauri/src/hook_setup.rs` — aturannya sama karena kita menyunting
// file konfigurasi milik user:
//  - Non-destruktif: hanya menambah/memperbaiki entri hook milik kita.
//  - Backup dulu ke `settings.json.bak` sebelum perubahan pertama.
//  - Idempoten: dijalankan tiap start, hanya menulis bila memang beda.
//  - Menyembuhkan diri: entri kita yang menunjuk path lama diperbarui.
//  - Gagal dengan tenang: JSON rusak → jangan timpa apa pun, lapor saja.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop'];

const claudeDir = () => {
  const dir = process.env.CLAUDE_CONFIG_DIR;
  return dir && dir.trim() ? dir : join(homedir(), '.claude');
};

function nodeAvailable() {
  try {
    execFileSync('node', ['--version'], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const commandFor = (script, event) => `node "${script.replaceAll('\\', '/')}" ${event}`;
const isOurs = (cmd) => typeof cmd === 'string' && cmd.includes('hitomi-notify.mjs');

/** Sisipkan/perbaiki entri hook kita untuk satu event. True bila ada perubahan. */
function ensureEvent(hooks, event, script) {
  const want = commandFor(script, event);
  if (!(event in hooks)) hooks[event] = [];
  const arr = hooks[event];
  if (!Array.isArray(arr)) return false; // bentuk tak terduga → jangan rusak apa pun
  for (const group of arr) {
    if (!Array.isArray(group?.hooks)) continue;
    for (const h of group.hooks) {
      if (!isOurs(h?.command)) continue;
      if (h.command === want) return false;
      h.command = want;
      return true;
    }
  }
  arr.push({ matcher: '*', hooks: [{ type: 'command', command: want }] });
  return true;
}

/** Pasang script + daftarkan hook. `notifySource` = isi `hooks/notify.mjs`. */
export function installHooks(notifySource) {
  const node = nodeAvailable();
  const report = (ready, changed, message) => ({ ready, changed, node, message });
  const dir = claudeDir();

  // 1) Tulis script hook (hanya bila isinya beda).
  const hooksDir = join(dir, 'hooks');
  const script = join(hooksDir, 'hitomi-notify.mjs');
  let changed = false;
  try {
    mkdirSync(hooksDir, { recursive: true });
  } catch {
    return report(false, false, `Gagal bikin folder ${hooksDir}`);
  }
  let current = '';
  try {
    current = readFileSync(script, 'utf8');
  } catch {
    /* belum ada */
  }
  if (current !== notifySource) {
    try {
      writeFileSync(script, notifySource);
    } catch {
      return report(false, false, `Gagal menulis ${script}`);
    }
    changed = true;
  }

  // 2) Daftarkan ke settings.json — hati-hati, ini file milik user.
  const settingsPath = join(dir, 'settings.json');
  let raw = '{}';
  try {
    raw = readFileSync(settingsPath, 'utf8');
  } catch {
    /* belum ada → mulai dari objek kosong */
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch (e) {
    return report(false, changed, `settings.json tak terbaca (${e.message}) — hook tak diubah.`);
  }
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) settings = {};
  if (settings.hooks === null || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) {
    settings.hooks = {};
  }

  let touched = false;
  for (const ev of EVENTS) if (ensureEvent(settings.hooks, ev, script)) touched = true;

  if (touched) {
    const backup = join(dir, 'settings.json.bak');
    if (existsSync(settingsPath) && !existsSync(backup)) {
      try {
        copyFileSync(settingsPath, backup);
      } catch {
        /* backup gagal tak menghalangi; sama dengan versi Rust */
      }
    }
    try {
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch {
      return report(false, changed, `Gagal menulis ${settingsPath}`);
    }
    changed = true;
  }

  const message = !node
    ? 'Hook terpasang, tapi Node.js tak terdeteksi — hook butuh Node untuk jalan.'
    : changed
      ? 'Hook Claude Code baru saja dipasang/diperbarui. Siap!'
      : 'Hook sudah terpasang.';
  return report(node, changed, message);
}
