import { TUNING } from '../config';
import { damp, makeSpring, springStep, type Spring } from '../math';
import { bendHairMesh } from '../rig/hairMesh';
import type { AvatarRig } from '../rig/AvatarRig';

/**
 * Rambut mengikuti kepala lewat DUA pegas per potong:
 *  - pegas pangkal  -> rotasi seluruh potongan (punya kecepatan, jadi melewati
 *    target lalu bergoyang sebelum diam — inilah kesan "berat").
 *  - pegas ujung    -> lebih lembek, jadi selalu tertinggal dari pangkal.
 * Selisih keduanya dipakai sebagai besar LENGKUNGAN mesh: rambut melengkung saat
 * bergerak dan lurus lagi saat diam, persis seperti rambut sungguhan.
 *
 * Potongan DI DALAM grup kepala (mis. rambut samping) sudah ikut berputar bersama
 * kepala, jadi rotasinya dipakai RELATIF (selisih terhadap kepala) supaya tidak
 * terhitung dua kali. Yang di luar kepala (rambut belakang) dipakai absolut.
 *
 * Poni tetap pakai peredam sederhana: dia lebar dan menempel di dahi, jadi
 * goyangan pegas malah terlihat seperti kesalahan.
 */
export class HairSway {
  private roots: Spring[] = [];
  private tips: Spring[] = [];
  private bangsVal = 0;

  update(rig: AvatarRig, headRot: number, dt: number): void {
    const h = TUNING.hair;

    rig.hairPieces.forEach((piece, i) => {
      this.roots[i] ??= makeSpring();
      this.tips[i] ??= makeSpring();

      const root = springStep(this.roots[i], headRot, h.stiffness, h.damping, dt);
      const tip = springStep(this.tips[i], root, h.tipStiffness, h.tipDamping, dt);

      const swing = piece.inHead ? root - headRot : root;
      piece.hair.mesh.rotation = swing * h.gain * piece.gain;
      // Ujung tertinggal di belakang pangkal -> melengkung ke arah berlawanan gerak.
      bendHairMesh(piece.hair, (root - tip) * h.bendPixels * piece.bend * piece.gain);
    });

    if (rig.bangs) {
      const b = TUNING.bangs;
      this.bangsVal = damp(this.bangsVal, headRot, b.smoothing, dt);
      rig.bangs.rotation = this.bangsVal * b.gain;
    }
  }
}
