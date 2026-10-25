/**
 * Lapisan shell desktop. Overlay punya dua shell:
 *  - **Tauri** (Windows): command lewat `invoke`, event lewat `listen`.
 *  - **Electron** (Linux, karena WebKitGTK di sana tak bisa diandalkan): API yang
 *    sama diekspos preload sebagai `window.hitomiShell` (lihat `electron/preload.cjs`).
 * Di browser dev biasa keduanya tak ada → `shellKind()` = null.
 *
 * Semua kode lain memakai modul ini, jadi tak ada yang perlu tahu shell mana yang jalan.
 */

export type ShellEvent = 'signal' | 'bubble' | 'setup' | 'clickthrough';
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
type CursorNorm = [number, number, number, number];

/** Kontrak yang diekspos `electron/preload.cjs`. Harus dijaga sama dengan file itu. */
interface ElectronShell {
  cursorNorm(): Promise<CursorNorm>;
  resizeOverlay(width: number): void;
  quitApp(): void;
  setClickThrough(on: boolean): void;
  setMenuAnchor(rect: Rect): void;
  on(event: ShellEvent, cb: (payload: unknown) => void): void;
}

const electronShell = (): ElectronShell | undefined =>
  (window as unknown as { hitomiShell?: ElectronShell }).hitomiShell;

export function shellKind(): 'tauri' | 'electron' | null {
  if (electronShell()) return 'electron';
  if (typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
    return 'tauri';
  }
  return null;
}

/** True jika renderer jalan di dalam shell desktop (bukan browser dev biasa). */
export const isShell = (): boolean => shellKind() !== null;

/** Posisi kursor global: [sx, sy] -1..1 relatif layar, [wu, wv] 0..1 di dalam window. */
export async function cursorNorm(): Promise<CursorNorm> {
  const e = electronShell();
  if (e) return e.cursorNorm();
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<CursorNorm>('cursor_norm');
}

export function resizeOverlay(width: number): void {
  const e = electronShell();
  if (e) return e.resizeOverlay(width);
  void import('@tauri-apps/api/core').then(({ invoke }) => invoke('resize_overlay', { width }));
}

export function quitApp(): void {
  const e = electronShell();
  if (e) return e.quitApp();
  void import('@tauri-apps/api/core').then(({ invoke }) => invoke('quit_app'));
}

/**
 * Tombol lingkaran tembus-klik hanya ada di Electron: saat tembus aktif, tombol itu
 * satu-satunya yang tetap bisa diklik. Tauri (Windows, build dibekukan) tetap
 * memakai toggle di tray.
 */
export const menuClickThroughSupported = (): boolean => electronShell() !== undefined;

export function setClickThrough(on: boolean): void {
  electronShell()?.setClickThrough(on);
}

/** Lapor kotak tombol lingkaran (koordinat window) agar shell menaruh pembuka kunci di sana. */
export function setMenuAnchor(rect: Rect): void {
  electronShell()?.setMenuAnchor(rect);
}

/**
 * Jadikan `handle` pegangan untuk menyeret window; `interactive` tetap bisa diklik.
 * Tauri: `startDragging()` saat mousedown. Electron tak punya padanannya, jadi
 * dipakai region drag native Chromium (`-webkit-app-region`).
 */
export function makeDraggable(handle: HTMLElement, interactive: HTMLElement[]): void {
  if (electronShell()) {
    handle.style.setProperty('-webkit-app-region', 'drag');
    interactive.forEach((el) => el.style.setProperty('-webkit-app-region', 'no-drag'));
    return;
  }
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
      getCurrentWindow().startDragging(),
    );
  });
}

/** Dengarkan event dari shell (bridge hook, bubble, laporan pemasangan hook). */
export async function onShell<T>(event: ShellEvent, cb: (payload: T) => void): Promise<void> {
  const e = electronShell();
  if (e) return e.on(event, (p) => cb(p as T));
  const { listen } = await import('@tauri-apps/api/event');
  await listen<T>(`hitomi://${event}`, (ev) => cb(ev.payload));
}
