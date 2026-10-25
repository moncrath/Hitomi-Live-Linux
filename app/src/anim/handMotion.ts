import { TUNING } from '../config';
import { damp } from '../math';
import type { AvatarRig } from '../rig/AvatarRig';

/**
 * Gerak tangan. Tiap tangan cuma SATU layer (tanpa siku), jadi amplitudonya
 * sengaja kecil — begitu berlebihan, mata langsung menangkap bahwa lengannya
 * satu keping kaku. Tangan juga ada di belakang badan, jadi gerak halus cukup.
 *
 * Dua lapis:
 *  1. Ikut napas (selalu) — geser vertikal halus, sedikit tertinggal dari dada.
 *     Tangan yang benar-benar diam bikin avatar terasa seperti stiker.
 *  2. Pose "malu-malu" saat `ngoding` — kedua tangan merapat ke dalam sedikit
 *     dan sedikit terangkat, lalu DITAHAN di situ.
 *
 * Catatan desain: versi pertama memakai getar naik-turun berfrekuensi tetap
 * (meniru mengetik) dan hasilnya terasa seperti robot — justru karena terlalu
 * teratur. Pose yang ditahan terbaca sebagai bahasa tubuh, bukan mekanik.
 */
export class HandMotion {
  private bob = 0;
  private pose = 0; // 0 = santai, 1 = pose malu-malu
  /**
   * Posisi diam tiap tangan, direkam sekali. Wajib: begitu poros dipindah ke bahu,
   * posisi dasarnya bukan lagi (0,0) — menulis `y` absolut akan melempar tangan
   * ke atas kepala.
   */
  private restY: number[] | null = null;

  /**
   * @param breathPhase fase napas (-1..1) dari `Breathing`, supaya seirama badan.
   * @param shy sedang `ngoding` (tool jalan).
   */
  update(rig: AvatarRig, breathPhase: number, shy: boolean, dt: number): void {
    const { handLeft, handRight } = rig;
    if (!handLeft && !handRight) return; // skin tanpa layer tangan

    this.restY ??= [handLeft?.y ?? 0, handRight?.y ?? 0];

    const h = TUNING.hands;
    this.bob = damp(this.bob, breathPhase * h.breathAmp, h.breathSmoothing, dt);
    this.pose = damp(this.pose, shy ? 1 : 0, h.poseSmoothing, dt);

    const lift = this.pose * h.shyLift;
    const rot = this.pose * h.shyRotation;

    // Rotasi dicerminkan: keduanya memutar KE DALAM, jadi terlihat merapat malu-malu
    // (kalau searah, badannya terlihat miring sebelah).
    const dy = this.bob - lift;
    if (handLeft) {
      handLeft.y = this.restY[0] + dy;
      handLeft.rotation = rot;
    }
    if (handRight) {
      handRight.y = this.restY[1] + dy;
      handRight.rotation = -rot;
    }
  }
}
