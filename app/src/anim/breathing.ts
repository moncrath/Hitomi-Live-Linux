import { TUNING } from '../config';
import type { AvatarRig } from '../rig/AvatarRig';

/** Napas: badan mengembang-kempis vertikal halus dari dasar (pivot bawah). */
export class Breathing {
  private t = 0;

  /** Fase napas saat ini (-1..1). Dipakai bagian lain (mis. tangan) agar seirama. */
  get phase(): number {
    return Math.sin(this.t * TUNING.breath.speed);
  }

  update(rig: AvatarRig, dt: number): void {
    this.t += dt;
    rig.body.scale.set(1, 1 + this.phase * TUNING.breath.amount);
  }
}
