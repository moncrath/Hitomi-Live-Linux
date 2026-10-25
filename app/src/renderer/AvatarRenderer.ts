import type { Container } from 'pixi.js';

/**
 * Kontrak antara "otak" (hook → event → state) dan "badan" (cara avatar digambar).
 * Semua di atas garis ini bicara SEMANTIK (state logis, ngomong, lihat ke mana),
 * bukan sprite/tekstur — jadi renderer bisa ditukar tanpa membedah `main.ts`.
 *
 * Implementasi:
 *  - `PngRenderer` — rig PNG berlayer (2.5D prosedural), yang dipakai sekarang.
 *  - `Live2DRenderer` — menyusul di branch `live2d` (Cubism SDK for Web).
 *
 * Renderer memegang sendiri semua animasinya (kedip, tilt, sway, napas): itu
 * detail cara menggambar, dan di Live2D digantikan parameter model.
 */
export interface AvatarRenderer {
  /** Node untuk ditambahkan ke stage pixi. */
  readonly view: Container;

  /** State logis yang sedang tampil (dibaca UI: bubble thinking, idle emote). */
  readonly currentState: string;

  /** Sedang menjalankan animasi "ngomong". */
  readonly isTalking: boolean;

  /** Terapkan state logis (`idle`, `mikir`, `ngoding`, `sukses`, `error`, ...). */
  setState(name: string): void;

  /** Terapkan event hook Claude Code (bisa berupa flash sekejap lalu balik). */
  event(name: string): void;

  /** Tampilkan state sekejap lalu balik ke `idle`. */
  flash(name: string, ms?: number): void;

  /** Nyalakan/matikan animasi "ngomong"; mati = wajah balik ke state logis. */
  setTalking(on: boolean): void;

  /**
   * Tempelkan node UI ke ruang koordinat avatar (ikut skala & posisinya),
   * mis. bubble "thinking" yang harus nempel di dekat kepala.
   */
  attachCanvasOverlay(node: Container): void;

  /** Sesuaikan skala/posisi ke ukuran window. */
  layout(width: number, height: number): void;

  /** Dipanggil tiap frame. `dt` dalam detik. */
  update(dt: number): void;
}
