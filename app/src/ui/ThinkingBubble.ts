import { Assets, Container, Sprite } from 'pixi.js';
import { CANVAS } from '../config';

/**
 * Bubble "thinking" (pixi) yang muncul saat mikir/ngoding. Aset 1080×1440
 * ter-registrasi di kanvas avatar → ditambahkan ke `rig.root` supaya posisinya
 * pas (dekat kepala) & ikut skala. Ikon di dalamnya berputar (progress).
 * Sisi ikut preferensi `hitomi.bubbleSide`: mode kiri = di-mirror horizontal.
 */
const BUBBLE_URL = '/ui/chat-bubble-thinking.png';
const ICON_URL = '/ui/thinking-icon-inside-bubble.png';
const ICON_CENTER = { x: 862.5, y: 463 }; // pusat alpha ikon (untuk pivot rotasi)
const ROT_SPEED = 2.6; // rad/detik

export class ThinkingBubble {
  readonly container = new Container();
  private icon: Sprite | null = null;
  private shown = false;
  private side = ''; // sisi terpasang (biar tak set transform tiap frame)

  async load(): Promise<void> {
    const [bubbleTex, iconTex] = await Promise.all([Assets.load(BUBBLE_URL), Assets.load(ICON_URL)]);
    const bubble = new Sprite(bubbleTex);
    const icon = new Sprite(iconTex);
    // Pivot ikon di pusat alpha-nya → berputar di tempat (bukan mengorbit).
    icon.pivot.set(ICON_CENTER.x, ICON_CENTER.y);
    icon.position.set(ICON_CENTER.x, ICON_CENTER.y);
    this.icon = icon;
    this.container.addChild(bubble, icon);
    this.container.visible = false;
  }

  private applySide(): void {
    const side = (localStorage.getItem('hitomi.bubbleSide') as 'left' | 'right') || 'right';
    if (side === this.side) return; // hanya set saat berubah
    this.side = side;
    if (side === 'left') {
      // Mirror horizontal terhadap sumbu tengah kanvas (x=540).
      this.container.scale.x = -1;
      this.container.x = CANVAS.width;
    } else {
      this.container.scale.x = 1;
      this.container.x = 0;
    }
  }

  setVisible(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    this.container.visible = on;
  }

  update(dt: number): void {
    if (!this.shown || !this.icon) return;
    this.applySide(); // reaktif ke toggle sisi (guard: hanya set saat berubah)
    this.icon.rotation += ROT_SPEED * dt;
  }
}
