/** Posisi kursor dinormalisasi ke offset dari pusat layar: -1..1 (x,y). */
export class PointerTracker {
  nx = 0; // -1..1 head-tilt/parallax (layar di Tauri, window di browser)
  ny = 0;
  wu = 0.5; // 0..1 posisi kursor dalam window (look-at mata)
  wv = 0.5;

  /**
   * @param attachDom Pasang listener `pointermove` DOM. Set `false` di shell desktop:
   *   di sana kursor dibaca global lewat poller (lihat `shellCursor.ts`), jadi listener
   *   window (skala window kecil) justru bikin nilai loncat-loncat.
   */
  constructor(target: Window = window, attachDom = true) {
    if (attachDom) {
      target.addEventListener('pointermove', (e) => {
        this.nx = (e.clientX / target.innerWidth) * 2 - 1;
        this.ny = (e.clientY / target.innerHeight) * 2 - 1;
        this.wu = e.clientX / target.innerWidth;
        this.wv = e.clientY / target.innerHeight;
      });
    }
  }
}
