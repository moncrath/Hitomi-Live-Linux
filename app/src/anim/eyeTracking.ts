import { Point } from 'pixi.js';
import { CANVAS, TUNING } from '../config';
import { clamp, damp } from '../math';
import type { Vec2 } from '../types';
import type { PointerTracker } from '../pointer';
import type { AvatarRig } from '../rig/AvatarRig';

/**
 * Pupil menatap TITIK kursor beneran (bukan sekadar condong ke arah layar).
 * Untuk tiap mata: hitung arah dari pusat mata (di layar, via `eyes.toGlobal`) ke
 * posisi kursor dalam window (`ptr.wu/wv`), lalu geser pupil sebanding — di-clamp ke
 * batas soket (`max_offset`). Reach = jarak (relatif ukuran avatar) untuk deflect penuh.
 *
 * Hanya aktif saat mata = base (idle/mikir/ngoding). Non-aktif → pupil balik mulus ke 0.
 */
export class EyeTracking {
  private oxL = 0;
  private oyL = 0;
  private oxR = 0;
  private oyR = 0;
  private readonly tmp = new Point();

  update(rig: AvatarRig, ptr: PointerTracker, active: boolean, dt: number): void {
    const [mx, my] = rig.manifest.eyes.pupils.max_offset;
    const s = rig.root.scale.x || 1;
    const reach = TUNING.eyes.reach;
    const rx = CANVAS.width * s * reach;
    const ry = CANVAS.height * s * reach;
    const cx = ptr.wu * window.innerWidth;
    const cy = ptr.wv * window.innerHeight;

    const target = (center: Vec2): [number, number] => {
      if (!active) return [0, 0];
      const g = rig.eyes.toGlobal(this.tmp.set(center[0], center[1]));
      return [clamp((cx - g.x) / rx, -1, 1) * mx, clamp((cy - g.y) / ry, -1, 1) * my];
    };

    const [txL, tyL] = target(rig.manifest.eyes.pupils.left.center);
    const [txR, tyR] = target(rig.manifest.eyes.pupils.right.center);

    this.oxL = damp(this.oxL, txL, TUNING.eyes.smoothing, dt);
    this.oyL = damp(this.oyL, tyL, TUNING.eyes.smoothing, dt);
    this.oxR = damp(this.oxR, txR, TUNING.eyes.smoothing, dt);
    this.oyR = damp(this.oyR, tyR, TUNING.eyes.smoothing, dt);

    // Poros pupil ada di pusatnya (lihat AvatarRig), jadi posisi = pusat + offset.
    const cl = rig.manifest.eyes.pupils.left.center;
    const cr = rig.manifest.eyes.pupils.right.center;
    rig.pupilL.position.set(cl[0] + this.oxL, cl[1] + this.oyL);
    rig.pupilR.position.set(cr[0] + this.oxR, cr[1] + this.oyR);
  }
}
