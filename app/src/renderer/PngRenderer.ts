import type { Container } from 'pixi.js';
import { CANVAS, TUNING } from '../config';
import type { Manifest } from '../types';
import type { PointerTracker } from '../pointer';
import { AvatarRig } from '../rig/AvatarRig';
import { StateController } from '../state/StateController';
import { HeadTilt } from '../anim/headTilt';
import { HairSway } from '../anim/hairSway';
import { EyeTracking } from '../anim/eyeTracking';
import { Blink } from '../anim/blink';
import { Breathing } from '../anim/breathing';
import { WingFlap } from '../anim/wingFlap';
import { ClothSway } from '../anim/clothSway';
import { HeadAccessorySway } from '../anim/headAccessorySway';
import { TalkAnim } from '../anim/talkAnim';
import { PupilExpression } from '../anim/pupilExpression';
import { HandMotion } from '../anim/handMotion';
import type { AvatarRenderer } from './AvatarRenderer';

/**
 * Renderer rig PNG berlayer: sprite pixi + animasi prosedural (kedip, eye/head
 * tracking, hair sway, napas, sayap, cloth, aksesoris kepala). Ekspresi = swap
 * tekstur mata/mulut lewat `StateController`.
 */
export class PngRenderer implements AvatarRenderer {
  private readonly rig = new AvatarRig();
  private state!: StateController;
  private blink!: Blink;

  private readonly headTilt = new HeadTilt();
  private readonly hairSway = new HairSway();
  private readonly eyeTracking = new EyeTracking();
  private readonly breathing = new Breathing();
  private readonly wingFlap = new WingFlap();
  private readonly clothSway = new ClothSway();
  private readonly headAccessorySway = new HeadAccessorySway();
  private readonly talk = new TalkAnim();
  private readonly pupilFx = new PupilExpression();
  private readonly hands = new HandMotion();

  constructor(private readonly ptr: PointerTracker) {}

  /** Bangun rig dari manifest. Wajib dipanggil sekali sebelum dipakai. */
  async load(manifest: Manifest): Promise<void> {
    await this.rig.build(manifest);
    this.state = new StateController(this.rig, manifest);
    this.blink = new Blink(manifest);
    this.state.apply('idle');
  }

  get view(): Container {
    return this.rig.root;
  }

  get currentState(): string {
    return this.state.current;
  }

  get isTalking(): boolean {
    return this.talk.isActive;
  }

  setState(name: string): void {
    this.state.apply(name);
  }

  event(name: string): void {
    this.state.event(name);
  }

  flash(name: string, ms?: number): void {
    this.state.flash(name, ms);
  }

  setTalking(on: boolean): void {
    if (on) {
      this.talk.start();
      return;
    }
    this.talk.stop();
    this.state.apply(this.state.current); // restore wajah ke state logis
  }

  attachCanvasOverlay(node: Container): void {
    this.rig.root.addChild(node);
  }

  layout(width: number, height: number): void {
    const s = Math.min(width / CANVAS.width, height / CANVAS.height) * TUNING.fitScale;
    this.rig.root.scale.set(s);
    this.rig.root.position.set(width / 2, height / 2);
  }

  update(dt: number): void {
    const { rig, ptr } = this;
    this.breathing.update(rig, dt);
    // Tangan mengetik saat tool jalan — menyambungkan avatar dgn apa yang benar-benar terjadi.
    this.hands.update(rig, this.breathing.phase, this.state.current === 'ngoding', dt);
    const headRot = this.headTilt.update(rig, ptr, dt);
    this.hairSway.update(rig, headRot, dt);
    this.wingFlap.update(rig, headRot, dt);
    this.clothSway.update(rig, headRot, dt);
    this.headAccessorySway.update(rig, headRot, dt);
    this.eyeTracking.update(rig, ptr, this.state.trackingActive, dt);
    // Setelah tracking: ekspresi pupil menumpang di atas posisi hasil tracking.
    // Saat mata variant tampil, pupil di-reset — bukan sekadar dilewati — supaya
    // efeknya tak membeku dan terbawa waktu mata normal balik.
    if (this.state.baseMode) {
      this.pupilFx.update(rig, this.state.current, dt);
    } else {
      this.pupilFx.reset(rig);
    }
    // TalkAnim menguasai mata+mulut selama aktif, jadi blink dimatikan.
    if (!this.talk.isActive) this.blink.update(rig, this.state.baseMode, dt);
    this.talk.update(rig, dt);
  }
}
