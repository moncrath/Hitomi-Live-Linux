import { TUNING } from '../config';
import { damp, makeSpring, springStep, type Spring } from '../math';
import { bendHairMesh } from '../rig/hairMesh';
import type { AvatarRig } from '../rig/AvatarRig';

/**
 * Aksesoris baju: pendulum halus — idle sine pelan + ikut condong kepala (gain kecil).
 *
 * Rantai panjang bisa minta `deform: true` di manifest → dirender sebagai mesh dan
 * ikut MELENGKUNG seperti rambut, bukan cuma berayun kaku. Liontin di ujung rantai
 * (layer terpisah) diberi lag lebih besar supaya terlihat tergantung di ujungnya,
 * bukan bergerak seirama badannya.
 */
export class ClothSway {
  private t = 0;
  private v = 0;
  private roots: Spring[] = [];
  private tips: Spring[] = [];

  update(rig: AvatarRig, headRot: number, dt: number): void {
    const c = TUNING.cloth;
    this.t += dt;
    this.v = damp(this.v, headRot * c.gain, c.smoothing, dt);

    // Sprite biasa: pendulum. Fase digeser tiap layer supaya tak seragam seperti satu benda.
    rig.cloths.forEach((node, i) => {
      node.rotation = Math.sin(this.t * c.idleSpeed + i * 0.7) * c.idleAmp + this.v;
    });

    // Mesh: pakai pegas seperti rambut supaya rantainya meliuk, bukan berayun kaku.
    const h = TUNING.hair;
    rig.clothPieces.forEach((piece, i) => {
      this.roots[i] ??= makeSpring();
      this.tips[i] ??= makeSpring();
      const target = Math.sin(this.t * c.idleSpeed + i * 0.7) * c.idleAmp + this.v;
      const root = springStep(this.roots[i], target, h.stiffness, h.damping, dt);
      const tip = springStep(this.tips[i], root, h.tipStiffness, h.tipDamping, dt);
      piece.hair.mesh.rotation = root * piece.gain;
      bendHairMesh(piece.hair, (root - tip) * h.bendPixels * piece.bend * piece.gain);
    });
  }
}
