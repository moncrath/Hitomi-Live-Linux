import { damp } from '../math';
import type { AvatarRig } from '../rig/AvatarRig';
import type { PupilFx } from '../types';

/**
 * Ekspresi lewat PUPIL, bukan lewat tukar gambar mata utuh.
 *
 * Kenapa: variant mata utuh punya pupil yang ikut ke-bake, jadi begitu Hitomi
 * berekspresi, eye-tracking MATI — dia berhenti menatapmu tepat di momen paling
 * emosional. Dengan menggerakkan pupilnya saja, dia bisa kaget/marah/jatuh cinta
 * **sambil tetap menatap kursor**.
 *
 * Semua efek di sini prosedural (skala, geser, getar, putar) → nol aset tambahan.
 * Tekstur pupil khusus (hati/spiral) bisa menyusul lewat `texture` di manifest.
 *
 * Dijalankan SETELAH `EyeTracking` supaya menumpang di atas posisi hasil tracking.
 */
const SMOOTHING = 0.002; // transisi antar ekspresi (fraksi tersisa setelah 1 detik)
const NEUTRAL: Required<Omit<PupilFx, 'texture'>> = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  shake: 0,
  spin: 0,
  pulse: 0,
};

export class PupilExpression {
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private shake = 0;
  private spinSpeed = 0;
  private pulseAmt = 0;
  private t = 0;
  private angle = 0;
  private appliedTexture = ''; // kunci pupil kiri yang sedang terpasang (hindari set tiap frame)

  update(rig: AvatarRig, state: string, dt: number): void {
    const def = rig.manifest.eyes.pupil_expressions?.[state];
    const fx = { ...NEUTRAL, ...(def ?? {}) };
    this.t += dt;
    this.applyTexture(rig, def?.texture);

    // Semua parameter di-damp, jadi perpindahan ekspresi mengalir, tak patah.
    this.scale = damp(this.scale, fx.scale, SMOOTHING, dt);
    this.ox = damp(this.ox, fx.offsetX, SMOOTHING, dt);
    this.oy = damp(this.oy, fx.offsetY, SMOOTHING, dt);
    this.shake = damp(this.shake, fx.shake, SMOOTHING, dt);
    this.pulseAmt = damp(this.pulseAmt, fx.pulse, SMOOTHING, dt);
    this.spinSpeed = damp(this.spinSpeed, fx.spin, SMOOTHING, dt);
    if (fx.spin === 0 && Math.abs(this.spinSpeed) < 0.05) {
      // Berhenti berputar -> pulang ke tegak. Tanpa ini pupil tertinggal miring
      // selamanya setelah keluar dari state `dizzy`.
      this.angle = damp(this.angle, 0, SMOOTHING, dt);
    } else {
      this.angle += this.spinSpeed * dt;
    }

    // Getar dipakai untuk kaget: acak tiap frame, kecil, jadi terbaca sebagai gemetar.
    const jx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const jy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const pulse = this.pulseAmt ? Math.sin(this.t * 6) * this.pulseAmt : 0;
    const s = this.scale + pulse;

    for (const pupil of [rig.pupilL, rig.pupilR]) {
      pupil.scale.set(s);
      pupil.rotation = this.angle;
      pupil.x += this.ox + jx;
      pupil.y += this.oy + jy;
    }
  }

  /**
   * Kembalikan pupil ke netral SEKETIKA. Dipanggil saat mata variant sedang tampil
   * (pupil tak kelihatan), supaya efek yang sedang jalan tidak membeku lalu ikut
   * terbawa saat mata normal muncul lagi — dulu ini bikin pupil normal masih
   * berputar setelah keluar dari `dizzy`.
   */
  reset(rig: AvatarRig): void {
    this.scale = 1;
    this.ox = this.oy = this.shake = this.pulseAmt = this.spinSpeed = 0;
    this.angle = 0;
    this.applyTexture(rig, undefined);
    for (const pupil of [rig.pupilL, rig.pupilR]) {
      pupil.scale.set(1);
      pupil.rotation = 0;
    }
  }

  /** Pasang tekstur pupil khusus (hati/spiral); tanpa `tex` → balik ke pupil normal. */
  private applyTexture(rig: AvatarRig, tex?: { left: string; right: string }): void {
    const base = rig.manifest.eyes.pupils;
    const want = tex ?? { left: base.left.file, right: base.right.file };
    if (want.left === this.appliedTexture) return;

    const texL = rig.textures.get(want.left);
    const texR = rig.textures.get(want.right);
    if (!texL || !texR) {
      // Skin tak punya pupil khusus ini → biarkan yang normal, jangan kosongkan mata.
      console.warn(`[pupil] tekstur "${want.left}"/"${want.right}" tak ada — pakai pupil normal.`);
      return;
    }
    rig.pupilL.texture = texL;
    rig.pupilR.texture = texR;
    this.appliedTexture = want.left;
  }
}
