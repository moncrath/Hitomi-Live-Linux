import type { AvatarRenderer } from '../renderer/AvatarRenderer';

/**
 * Saat idle, sesekali Hitomi flash ekspresi lucu bentar lalu balik normal.
 * Hanya jalan bila `canEmote()` true (mis. sedang idle & tidak "ngomong").
 */
const EMOTES = ['love', 'sukses', 'minder'] as const; // ekspresi ceria/imut saat idle
const MIN_GAP = 7000; // jeda min antar emote (ms)
const MAX_GAP = 16000; // jeda maks (ms)
const HOLD = 1400; // durasi tampil sebelum balik idle (ms)

export class IdleEmote {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly renderer: AvatarRenderer,
    private readonly canEmote: () => boolean,
  ) {}

  start(): void {
    this.schedule();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
    this.timer = setTimeout(() => this.fire(), gap);
  }

  private fire(): void {
    if (this.canEmote()) {
      const name = EMOTES[Math.floor(Math.random() * EMOTES.length)];
      this.renderer.flash(name, HOLD);
    }
    this.schedule();
  }
}
