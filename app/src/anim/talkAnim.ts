import type { AvatarRig } from '../rig/AvatarRig';

/**
 * Animasi "ngomong" saat bubble teks tampil. Selama aktif, MENGUASAI wajah:
 *  - Mata dipaksa `closed_happy` (di-assert tiap frame, jadi tahan walau flash/idle
 *    mengubah state di tengah jalan) → mata happy bertahan sepanjang durasi ngomong.
 *  - Mulut gantian 2 frame bicara (`talk_open`=9aa / `talk_closed`=9ab).
 * Saat berhenti, pemanggil me-restore wajah ke state saat ini (StateController.apply).
 */
const TALK_OPEN = 'talk_open';
const TALK_CLOSED = 'talk_closed';
const HAPPY_EYES = 'closed_happy';

export class TalkAnim {
  private active = false;
  private acc = 0;
  private open = false;

  get isActive(): boolean {
    return this.active;
  }

  start(): void {
    this.active = true;
    this.acc = 0;
    this.open = false;
  }

  stop(): void {
    this.active = false;
  }

  update(rig: AvatarRig, dt: number): void {
    if (!this.active) return;

    // Mata closed_happy (assert tiap frame biar tahan interupsi flash/idle).
    const eyeTex = rig.textures.get(rig.manifest.eyes.variants[HAPPY_EYES]);
    if (eyeTex) rig.eyeVariant.texture = eyeTex;
    rig.eyeVariant.visible = true;
    rig.eyeBg.visible = rig.pupilL.visible = rig.pupilR.visible = rig.eyeFrame.visible = false;
    rig.eyeBlink.visible = false;

    // Mulut buka-tutup.
    this.acc += dt;
    const interval = this.open ? 0.13 : 0.1; // buka sedikit lebih lama dari tutup
    if (this.acc < interval) return;
    this.acc = 0;
    this.open = !this.open;
    const name = this.open ? TALK_OPEN : TALK_CLOSED;
    const tex = rig.textures.get(rig.manifest.mouths[name]);
    if (tex) rig.mouth.texture = tex;
  }
}
