import type { PointerTracker } from './pointer';
import { cursorNorm } from './shell';

/**
 * Saat overlay click-through, webview tak menerima `mousemove`, jadi eye/head-tracking
 * kehilangan sumber kursor. Di sini kita polling posisi kursor GLOBAL dari shell
 * (sudah dinormalisasi) dan menyuntikkannya ke tracker.
 */
export async function startShellCursor(ptr: PointerTracker): Promise<void> {
  const tick = async (): Promise<void> => {
    try {
      const [sx, sy, wu, wv] = await cursorNorm();
      ptr.nx = sx;
      ptr.ny = sy;
      ptr.wu = wu;
      ptr.wv = wv;
    } catch {
      /* command belum siap saat boot awal — abaikan, coba lagi frame berikut */
    }
    setTimeout(tick, 16); // ~60fps
  };
  void tick();
}
