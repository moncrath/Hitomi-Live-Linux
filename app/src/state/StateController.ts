import type { Manifest } from '../types';
import type { AvatarRig } from '../rig/AvatarRig';

/** Durasi state "flash" (sukses/love) sebelum balik ke state dasar. */
const FLASH_MS = 1600;

/**
 * Menerapkan state (swap mata utuh/variant + mulut + flag tracking) dan event
 * (flash sekejap lalu balik). Menyimpan mode aktif untuk dibaca animasi.
 */
export class StateController {
  current = 'idle';
  baseMode = true; // mata = base (pupil bergerak) vs variant (beku)
  trackingWanted = true;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly rig: AvatarRig,
    private readonly m: Manifest,
  ) {}

  /** Tracking benar-benar jalan hanya bila state minta DAN mata = base. */
  get trackingActive(): boolean {
    return this.trackingWanted && this.baseMode;
  }

  apply(name: string): void {
    const st = this.m.states[name];
    if (!st) {
      console.warn(`State tak dikenal: ${name}`);
      return;
    }
    this.current = name;
    const { rig } = this;

    this.applyMouth();

    // Variant yang diminta tapi tak dimiliki skin -> JANGAN sembunyikan mata dasar,
    // nanti wajahnya jadi kosong. Lebih baik tetap mata biasa (tracking tetap hidup).
    const variantKey = st.eyes === 'base' ? undefined : this.m.eyes.variants[st.eyes];
    const variantTex = variantKey ? rig.textures.get(variantKey) : undefined;
    if (variantKey && !variantTex) {
      console.warn(`[state ${name}] variant mata "${st.eyes}" tak ada di skin ini — pakai mata dasar.`);
    }

    if (variantTex) {
      this.baseMode = false;
      rig.eyeVariant.texture = variantTex;
      rig.eyeVariant.visible = true;
      rig.eyeBg.visible = rig.pupilL.visible = rig.pupilR.visible = rig.eyeFrame.visible = false;
      rig.eyeBlink.visible = false;
    } else {
      this.baseMode = true;
      rig.eyeVariant.visible = false;
      rig.eyeBg.visible = rig.pupilL.visible = rig.pupilR.visible = rig.eyeFrame.visible = true;
    }

    // Tracking cuma masuk akal saat mata dasar tampil.
    this.trackingWanted = st.tracking && this.baseMode;
  }

  /** Set tekstur mulut dari state saat ini (acak bila `mouths[]`). Dipisah agar
   *  bisa dipanggil ulang setelah animasi "ngomong" selesai (lihat MouthTalk). */
  private applyMouth(): void {
    const st = this.m.states[this.current];
    if (!st) return;
    const mouthName =
      st.mouths && st.mouths.length
        ? st.mouths[Math.floor(Math.random() * st.mouths.length)]
        : st.mouth;
    const key = mouthName ? this.m.mouths[mouthName] : undefined;
    if (key) {
      const tex = this.rig.textures.get(key);
      if (tex) this.rig.mouth.texture = tex;
    }
  }

  /** Peta hook Claude Code -> reaksi. */
  event(name: string): void {
    const ev = this.m.events[name];
    if (!ev) {
      console.warn(`Event tak dikenal: ${name}`);
      return;
    }
    if (ev.flash) {
      this.flash(ev.flash, FLASH_MS, ev.then ?? 'idle');
    } else if (ev.state) {
      if (this.flashTimer) {
        clearTimeout(this.flashTimer);
        this.flashTimer = null;
      }
      this.apply(ev.state);
    }
  }

  /** Tampilkan state sekejap lalu balik ke `back`. Dipakai event flash & idle emote. */
  flash(name: string, ms: number = FLASH_MS, back = 'idle'): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.apply(name);
    this.flashTimer = setTimeout(() => this.apply(back), ms);
  }
}
