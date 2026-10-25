// Shell Electron untuk Linux. Padanan `app/src-tauri/src/lib.rs`: window overlay
// transparan + always-on-top, tray (tembus-klik + keluar), bridge hook, pemasang
// hook, dan kursor global. Kenapa bukan Tauri di Linux: lihat Decision Log 2026-10-25.

import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, protocol, screen, Tray } from 'electron';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startBridge } from './bridge.mjs';
import { installHooks } from './hookSetup.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'app', 'dist');
const ICON = join(ROOT, 'app', 'src-tauri', 'icons', '128x128.png');
// Dari source maupun dari paket (AppImage/deb), tata letak di bawah ROOT sama:
// `electron-builder.yml` menyalin dist/ikon/notify.mjs ke asar dengan struktur repo.
const NOTIFY_MJS = join(ROOT, 'hooks', 'notify.mjs');

// Di Wayland native aplikasi tak boleh tahu posisi kursor global maupun memindah
// window sendiri; lewat XWayland keduanya jalan. Flag `--ozone-platform=x11` HARUS
// di baris perintah (appendSwitch di sini sudah terlambat, platform sudah dipilih),
// jadi dipasang di skrip `start`. AppImage dijalankan tanpa argumen, jadi bila flag
// belum ada kita relaunch diri sendiri dengan flag itu. Tanpa flag, overlay tetap
// tampil, tapi tracking mata diam dan posisi awal diabaikan compositor.
// Cek `process.argv`, bukan `commandLine.hasSwitch`: Chromium menambahkan sendiri
// `ozone-platform=wayland` ke commandLine saat memilih platform otomatis.
if (process.env.WAYLAND_DISPLAY && !process.argv.some((a) => a.startsWith('--ozone-platform'))) {
  // Di AppImage `execPath` menunjuk ke mount sementara yang lenyap saat proses ini
  // keluar; `APPIMAGE` menunjuk ke file .AppImage-nya.
  // `app.relaunch` tak jalan di AppImage (diuji), jadi proses baru dilepas manual.
  spawn(process.env.APPIMAGE || process.execPath, [...process.argv.slice(1), '--ozone-platform=x11'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  app.exit(0);
}

// Frontend memakai path absolut (/avatar/...), jadi file:// tak bisa dipakai (akan
// menunjuk ke root filesystem). Skema custom (app://) juga tidak: pixi hanya
// menganggap http(s) sebagai URL, dan untuk skema lain memotong host saat
// me-resolve path absolut (app://hitomi/x → app://x). Jadi dist/ disajikan di
// host http palsu yang dicegat di sini — tak ada port yang dibuka.
const APP_HOST = 'hitomi.localhost';
const APP_URL = `http://${APP_HOST}/index.html`;

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let tray = null;
// Tembus-klik = mode pilihan user (tray / tombol lingkaran). Saat aktif, seluruh
// window avatar tembus, lalu window kecil tak terlihat (`unlock`) ditaruh tepat di
// atas tombol lingkaran: klik di sana mematikan tembus. Jadi tombolnya tak pernah
// ikut terkunci (masalah yang dulu memindah toggle ke tray).
//
// Kenapa bukan "tembus kecuali saat kursor di atas menu": di XWayland posisi kursor
// membeku begitu kursor ada di atas window Wayland native, dan window yang tembus
// membuat kursor secara teknis berada di window di belakangnya. Kenapa bukan
// `setShape`: di X11 itu ikut memotong render, avatar akan hilang.
let clickThrough = false;
let unlock = null;
/** Kotak tombol lingkaran dalam koordinat window avatar (dilaporkan renderer). */
let anchor = null;

const emit = (event, payload) => win?.webContents.send('hitomi', event, payload);

function serveDist() {
  protocol.handle('http', (req) => {
    const url = new URL(req.url);
    // Selain host kita (mis. dev server Vite), teruskan apa adanya.
    if (url.hostname !== APP_HOST) return net.fetch(req, { bypassCustomProtocolHandlers: true });
    const path = decodeURIComponent(url.pathname);
    const file = normalize(join(DIST, path === '/' ? 'index.html' : path));
    // Cegah path traversal keluar dari dist/.
    if (!file.startsWith(DIST + sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const width = 500;
  const height = 680;
  // workArea sudah mengecualikan panel KDE, jadi tak perlu menebak tinggi taskbar.
  const area = screen.getPrimaryDisplay().workArea;
  const margin = 24;
  win = new BrowserWindow({
    width,
    height,
    x: area.x + area.width - width - margin,
    y: area.y + area.height - height - margin,
    title: 'Hitomi Live',
    icon: ICON,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(ROOT, 'electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // Muncul tanpa merebut fokus dari editor (setara `focus: false` di Tauri).
  win.once('ready-to-show', () => win.showInactive());

  // Overlay tak pernah boleh pindah halaman atau membuka window lain.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const devUrl = process.env.HITOMI_DEV_URL;
  void win.loadURL(devUrl || APP_URL);
  // Window pembuka kunci (tersembunyi) jangan sampai menahan app tetap hidup.
  win.on('closed', () => {
    win = null;
    app.quit();
  });
}

function createUnlockWindow() {
  // Transparan tapi tetap menangkap klik: di X11 area input tak bergantung pada alpha.
  unlock = new BrowserWindow({
    width: 34,
    height: 34,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(ROOT, 'electron', 'unlock-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  unlock.webContents.on('will-navigate', (e) => e.preventDefault());
  unlock.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void unlock.loadURL('data:text/html,<body style="margin:0;cursor:pointer"></body>');
  unlock.on('closed', () => (unlock = null));
}

/** Tempelkan window pembuka kunci ke tombol lingkaran; tampil hanya saat tembus aktif. */
function syncUnlock() {
  if (!unlock || !win) return;
  if (!clickThrough || !anchor) return unlock.hide();
  const b = win.getBounds();
  unlock.setBounds({
    x: Math.round(b.x + anchor.x),
    y: Math.round(b.y + anchor.y),
    width: Math.round(anchor.width),
    height: Math.round(anchor.height),
  });
  if (!unlock.isVisible()) unlock.showInactive();
  unlock.moveTop();
}

const trayMenu = () =>
  Menu.buildFromTemplate([
    { label: `Tembus klik: ${clickThrough ? 'ON' : 'OFF'}`, click: () => setClickThrough(!clickThrough) },
    { label: 'Keluar Hitomi 💔', click: () => app.quit() },
  ]);

/** Satu-satunya pengubah mode: tray dan menu in-app selalu sinkron lewat sini. */
function setClickThrough(on) {
  clickThrough = on;
  win?.setIgnoreMouseEvents(on);
  syncUnlock();
  tray?.setContextMenu(trayMenu());
  emit('clickthrough', on);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 22, height: 22 }));
  tray.setToolTip('Hitomi Live — klik kanan untuk menu');
  tray.setContextMenu(trayMenu());
}

/** IPC hanya diterima dari window overlay kita sendiri. */
const fromOverlay = (e) => win && e.sender === win.webContents;

function registerIpc() {
  // Sama dengan `cursor_norm` Rust: [sx, sy] -1..1 relatif layar primer,
  // [wu, wv] 0..1 posisi kursor di dalam window (untuk look-at mata).
  ipcMain.handle('cursor_norm', (e) => {
    if (!fromOverlay(e)) return [0, 0, 0.5, 0.5];
    const p = screen.getCursorScreenPoint();
    const s = screen.getPrimaryDisplay().bounds;
    const w = win.getBounds();
    return [
      ((p.x - s.x) / Math.max(1, s.width)) * 2 - 1,
      ((p.y - s.y) / Math.max(1, s.height)) * 2 - 1,
      (p.x - w.x) / Math.max(1, w.width),
      (p.y - w.y) / Math.max(1, w.height),
    ];
  });

  // Rasio 3:4 sesuai kanvas avatar; anchor di titik tengah supaya posisi hasil drag tetap.
  ipcMain.on('resize_overlay', (e, width) => {
    if (!fromOverlay(e) || !Number.isFinite(width)) return;
    const w = Math.round(Math.min(1200, Math.max(240, width)));
    const h = Math.round((w * 4) / 3);
    const b = win.getBounds();
    win.setBounds({
      x: Math.round(b.x + b.width / 2 - w / 2),
      y: Math.round(b.y + b.height / 2 - h / 2),
      width: w,
      height: h,
    });
  });

  ipcMain.on('quit_app', (e) => fromOverlay(e) && app.quit());

  ipcMain.on('set_click_through', (e, on) => {
    if (fromOverlay(e) && typeof on === 'boolean') setClickThrough(on);
  });
  // Posisi tombol lingkaran berubah saat sisi menu diganti atau window di-resize.
  ipcMain.on('menu_anchor', (e, r) => {
    if (!fromOverlay(e) || !r) return;
    const nums = [r.x, r.y, r.width, r.height];
    if (!nums.every(Number.isFinite) || r.width < 1 || r.height < 1 || r.width > 200 || r.height > 200) return;
    anchor = { x: r.x, y: r.y, width: r.width, height: r.height };
    syncUnlock();
  });

  // Klik pada window pembuka kunci (yang menutupi tombol lingkaran): matikan tembus.
  ipcMain.on('unlock_click', (e) => {
    if (!unlock || e.sender !== unlock.webContents) return;
    setClickThrough(false);
  });
}

app.whenReady().then(() => {
  serveDist();
  registerIpc();
  createWindow();
  createUnlockWindow();
  // Window avatar diseret/di-resize → pembuka kunci ikut pindah.
  win.on('move', syncUnlock);
  win.on('resize', syncUnlock);
  createTray();
  startBridge(emit);

  // Pasang hook Claude Code sendiri (idempoten, non-destruktif). Laporannya
  // disimpan preload, jadi aman dikirim sebelum renderer selesai boot.
  let report;
  try {
    report = installHooks(readFileSync(NOTIFY_MJS, 'utf8'));
  } catch (e) {
    report = { ready: false, changed: false, node: true, message: `notify.mjs tak terbaca: ${e.message}` };
  }
  console.info(`[setup] ${report.message}`);
  win.webContents.once('did-finish-load', () => {
    emit('setup', report);
    emit('clickthrough', clickThrough);
  });
});

app.on('window-all-closed', () => app.quit());
