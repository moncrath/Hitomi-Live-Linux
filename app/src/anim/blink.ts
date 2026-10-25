import type { Manifest } from '../types';
import type { AvatarRig } from '../rig/AvatarRig';

/** Kedip: overlay mata tertutup sekejap, hanya saat mata = base. */
export class Blink {
  private timer = 0;
  private next = 0;

  constructor(private readonly m: Manifest) {
    this.schedule();
  }

  private schedule(): void {
    const [a, b] = this.m.blink.interval_ms;
    this.next = (a + Math.random() * (b - a)) / 1000;
    this.timer = 0;
  }

  update(rig: AvatarRig, baseMode: boolean, dt: number): void {
    if (!baseMode) {
      rig.eyeBlink.visible = false;
      return;
    }
    this.timer += dt;
    const dur = this.m.blink.duration_ms / 1000;

    if (this.timer >= this.next + dur) {
      this.schedule();
    }

    // Saat mata tertutup, matikan mata base biar tak nyembul di balik overlay.
    const closed = this.timer >= this.next && this.timer < this.next + dur;
    rig.eyeBlink.visible = closed;
    const showBase = !closed;
    rig.eyeBg.visible = showBase;
    rig.pupilL.visible = showBase;
    rig.pupilR.visible = showBase;
    rig.eyeFrame.visible = showBase;
  }
}
