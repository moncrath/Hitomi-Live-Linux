import { TUNING } from '../config';
import { damp } from '../math';
import type { AvatarRig } from '../rig/AvatarRig';

/**
 * Plume kepala (15a). Karena ini CHILD dari head (sudah ikut rotasi kepala),
 * sway = rotasi RELATIF: (lag - headRot). Saat kepala menyentak, plume tertinggal
 * sesaat lalu menyusul -> efek trailing. Idle (kepala diam) -> kembali ke 0.
 */
export class HeadAccessorySway {
  private lag = 0;

  update(rig: AvatarRig, headRot: number, dt: number): void {
    if (!rig.headAccessories.length) return; // skin tanpa aksesoris kepala bergerak
    const h = TUNING.headAcc;
    this.lag = damp(this.lag, headRot, h.smoothing, dt);
    // Semua aksesoris diayun SEARAH dan berlawanan dengan gerak kepala: kursor ke
    // kiri -> telinga tertinggal ke kanan, seperti benda yang ikut terseret.
    // (Sempat dibuat mirror kiri-kanan, tapi terlihat seperti telinga mengepak.)
    const rel = (this.lag - headRot) * h.gain;
    for (const node of rig.headAccessories) node.rotation = rel;
  }
}
