// Jembatan sempit renderer ↔ main. Kontraknya dipakai `app/src/shell.ts`
// (interface ElectronShell) — ubah salah satu, ubah keduanya.
// Preload sandboxed harus CommonJS, makanya .cjs.

const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = ['signal', 'bubble', 'setup', 'clickthrough'];
// Event bernilai "keadaan" (bukan kejadian) dikirim main sekali saat start, sering
// SEBELUM renderer selesai boot (pixi + manifest dulu). Nilai terakhirnya disimpan
// supaya pendengar yang datang belakangan tetap dapat.
const STATEFUL = ['setup', 'clickthrough'];
const listeners = Object.fromEntries(EVENTS.map((e) => [e, []]));
const last = {};

ipcRenderer.on('hitomi', (_e, event, payload) => {
  if (!EVENTS.includes(event)) return;
  if (STATEFUL.includes(event)) last[event] = payload;
  for (const cb of listeners[event]) cb(payload);
});

contextBridge.exposeInMainWorld('hitomiShell', {
  cursorNorm: () => ipcRenderer.invoke('cursor_norm'),
  resizeOverlay: (width) => ipcRenderer.send('resize_overlay', Number(width)),
  quitApp: () => ipcRenderer.send('quit_app'),
  setClickThrough: (on) => ipcRenderer.send('set_click_through', on === true),
  setMenuAnchor: (r) =>
    ipcRenderer.send('menu_anchor', {
      x: Number(r?.x),
      y: Number(r?.y),
      width: Number(r?.width),
      height: Number(r?.height),
    }),
  on: (event, cb) => {
    if (!EVENTS.includes(event) || typeof cb !== 'function') return;
    listeners[event].push(cb);
    if (event in last) cb(last[event]);
  },
});
