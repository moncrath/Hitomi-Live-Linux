import { TUNING } from '../config';
import { damp } from '../math';
import type { AvatarRig } from '../rig/AvatarRig';

/** Sayap belakang: flap idle (sine, mirror kiri-kanan) + condong ikut kepala dengan lag. */
export class WingFlap {
  private t = 0;
  private react = 0;

  update(rig: AvatarRig, headRot: number, dt: number): void {
    if (!rig.wings.length) return; // skin tanpa sayap
    const w = TUNING.wings;
    this.t += dt;
    const flap = Math.sin(this.t * w.idleSpeed) * w.idleAmp;
    this.react = damp(this.react, headRot * w.reactGain, w.smoothing, dt);

    // Mirror: yang berindeks genap/ganjil mengepak berlawanan (buka-tutup),
    // plus semuanya condong sama ke arah kepala.
    rig.wings.forEach((wing, i) => {
      wing.rotation = (i % 2 === 0 ? flap : -flap) + this.react;
    });
  }
}
