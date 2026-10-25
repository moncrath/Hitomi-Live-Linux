import { TUNING } from '../config';
import { damp } from '../math';
import type { PointerTracker } from '../pointer';
import type { AvatarRig } from '../rig/AvatarRig';

/** Tilt 2.5D: kepala condong + parallax halus ke arah kursor. Kembalikan rotasi kepala (rad). */
export class HeadTilt {
  private rot = 0;

  update(rig: AvatarRig, ptr: PointerTracker, dt: number): number {
    const t = TUNING.head;
    this.rot = damp(this.rot, ptr.nx * t.maxRot, t.smoothing, dt);
    rig.head.rotation = this.rot;

    const [px, py] = rig.manifest.groups.head_group.pivot;
    rig.head.position.set(px + ptr.nx * t.parallaxX, py + TUNING.dropY + ptr.ny * t.parallaxY);
    return this.rot;
  }
}
