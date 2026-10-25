import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { CANVAS, TUNING, layerUrl, getSkin } from '../config';
import type { DynamicMember, Manifest, Roles, Vec2 } from '../types';
import { makeHairMesh, type HairMesh } from './hairMesh';

/** Nama layer bawaan untuk peran khusus; per-skin bisa ditimpa lewat `manifest.roles`. */
const DEFAULT_ROLES: Required<Roles> = {
  body: '7_body',
  headbase: '8_headbase',
  mouth: '9b_mouth_closed',
  bangs: '12_bangs',
  handLeft: '5_lefthand',
  handRight: '6_righthand',
};

/**
 * Layer di atas nomor ini ikut GRUP KEPALA (tilt bersama kepala).
 * Konvensi penomoran aset: 1–7 badan & belakang, 8 ke atas kepala.
 * Dipakai sebagai aturan tunggal supaya skin bebas menamai layernya sendiri —
 * hanya nomor depannya yang menentukan tempat.
 */
const HEAD_FROM = 8;

/** Layer bergerak yang dirender sebagai mesh (bisa diputar DAN dilengkungkan). */
export interface DeformPiece {
  hair: HairMesh;
  pivot: Vec2;
  gain: number;
  bend: number;
  /**
   * Berada di dalam grup kepala. Kalau ya, layer ini SUDAH ikut rotasi kepala,
   * jadi sway-nya harus RELATIF (selisih dari kepala) — kalau tidak, gerakannya
   * terhitung dua kali dan rambut samping akan terlihat lepas.
   */
  inHead: boolean;
}

/**
 * Menyusun layer PNG jadi graf pixi mengikuti `z_order_idle` manifest:
 *  root
 *   ├ backWings   (grup back_dynamic — flap)
 *   ├ backHair    (grup hair_dynamic non-poni — mesh, sway + lengkung)
 *   ├ layer badan (tangan, badan, aksesoris baju)
 *   └ head        (poros leher; semua layer bernomor >= 8)
 *        └ eyes   (base + variant + blink)
 *
 * Semua layer sekanvas (mis. 1080×1440) -> anchor 0 di (0,0) = registrasi otomatis.
 * Layer yang tak ada di skin di-SKIP (bukan crash); hanya peran inti yang wajib.
 */
export class AvatarRig {
  readonly root = new Container();
  readonly head = new Container();
  readonly eyes = new Container();
  readonly backHair = new Container();
  readonly backWings = new Container();

  readonly textures = new Map<string, Texture>();

  manifest!: Manifest;
  private roles: Required<Roles> = DEFAULT_ROLES;

  // Referensi untuk animasi.
  body!: Sprite;
  mouth!: Sprite;
  eyeBg!: Sprite;
  pupilL!: Sprite;
  pupilR!: Sprite;
  eyeFrame!: Sprite;
  eyeVariant!: Sprite;
  eyeBlink!: Sprite;
  bangs: Sprite | null = null;
  handLeft: Sprite | null = null;
  handRight: Sprite | null = null;
  hairPieces: DeformPiece[] = [];
  /** Rantai/kain yang ikut melengkung (opt-in `deform: true` di manifest). */
  clothPieces: DeformPiece[] = [];

  // Aksesoris bergerak. Jumlahnya ikut manifest — skin boleh punya 0, 1, atau banyak
  // (mis. dua telinga kelinci, dua rantai) tanpa ubah kode.
  wings: Sprite[] = [];
  cloths: Sprite[] = [];
  headAccessories: Sprite[] = [];

  private tex(key: string): Texture {
    const t = this.textures.get(key);
    if (!t) throw new Error(`Tekstur belum dimuat: ${key}`);
    return t;
  }

  /** Sprite dari layer OPSIONAL: null bila tekstur tak dimuat (skin tak punya). */
  private tryMake(key: string): Sprite | null {
    const t = this.textures.get(key);
    if (!t) return null;
    const s = new Sprite(t);
    s.label = key;
    return s;
  }

  /** Set pivot = posisi (poros rotasi di tempat) bila pivot tersedia di manifest. */
  private setPivot(sprite: Sprite, pivot?: Vec2): void {
    if (!pivot) return;
    sprite.pivot.set(pivot[0], pivot[1]);
    sprite.position.set(pivot[0], pivot[1]);
  }

  /** Nomor urut di awal nama layer ("12a_bangs" -> 12). Tanpa nomor dianggap badan. */
  private layerNumber(key: string): number {
    const m = /^(\d+)/.exec(key);
    return m ? Number(m[1]) : 0;
  }

  async build(manifest: Manifest): Promise<void> {
    this.manifest = manifest;
    this.roles = { ...DEFAULT_ROLES, ...manifest.roles };

    await this.loadTextures(manifest);
    this.assertCore();

    const g = manifest.groups;
    const hairPivots = g.hair_dynamic?.members ?? {};
    const wingPivots = g.back_dynamic?.members ?? {};
    const clothPivots = g.cloth_dynamic?.members ?? {};
    const headAccPivots = g.head_accessory_dynamic?.members ?? {};
    const eyeBaseKeys = new Set(manifest.eyes.base);

    // Kontainer dipasang ke root SAAT PERTAMA dibutuhkan, sambil menelusuri z_order
    // dari bawah ke atas -> urutan tumpuknya otomatis benar tanpa daftar terpisah.
    let wingsAdded = false;
    let backHairAdded = false;
    let headAdded = false;
    let eyesAdded = false;

    for (const key of manifest.z_order_idle) {
      if (!this.textures.has(key)) continue; // layer opsional yang tak dimiliki skin ini
      const inHead = this.layerNumber(key) >= HEAD_FROM;

      // --- rambut: mesh (bisa melengkung). Poni dikecualikan — dia lebar & menempel
      //     dahi, jadi cukup diputar seperti sprite biasa. ---
      const hairDef = hairPivots[key];
      if (hairDef && key !== this.roles.bangs) {
        if (inHead && !headAdded) {
          this.addHead(manifest);
          headAdded = true;
        }
        const piece = this.makeDeformPiece(key, hairDef, inHead);
        this.hairPieces.push(piece);
        if (inHead) {
          this.head.addChild(piece.hair.mesh);
        } else {
          this.backHair.addChild(piece.hair.mesh);
          if (!backHairAdded) {
            this.backHair.y = TUNING.dropY; // ikut turun bareng kepala
            this.root.addChild(this.backHair);
            backHairAdded = true;
          }
        }
        continue;
      }

      // --- kain/rantai yang minta melengkung (mis. rantai panjang) ---
      const clothDef = clothPivots[key];
      if (clothDef?.deform) {
        const piece = this.makeDeformPiece(key, clothDef, inHead);
        this.clothPieces.push(piece);
        (inHead ? this.head : this.root).addChild(piece.hair.mesh);
        continue;
      }

      const sprite = this.tryMake(key);
      if (!sprite) continue;

      // --- sayap / panel belakang ---
      if (wingPivots[key]) {
        this.setPivot(sprite, wingPivots[key].pivot);
        this.applyOffset(sprite, wingPivots[key].offset);
        this.wings.push(sprite);
        this.backWings.addChild(sprite);
        if (!wingsAdded) {
          this.backWings.y = TUNING.wings.dropY;
          this.root.addChild(this.backWings);
          wingsAdded = true;
        }
        continue;
      }

      // --- aksesoris baju (pendulum) ---
      if (clothPivots[key]) {
        this.setPivot(sprite, clothPivots[key].pivot);
        this.applyOffset(sprite, clothPivots[key].offset);
        this.cloths.push(sprite);
        this.root.addChild(sprite);
        continue;
      }

      if (inHead && !headAdded) {
        this.addHead(manifest);
        headAdded = true;
      }
      const parent = inHead ? this.head : this.root;

      // --- aksesoris kepala yang bergoyang (trailing di dalam head) ---
      if (headAccPivots[key]) {
        this.setPivot(sprite, headAccPivots[key].pivot);
        this.applyOffset(sprite, headAccPivots[key].offset);
        this.headAccessories.push(sprite);
        parent.addChild(sprite);
        continue;
      }

      // --- mata: dikumpulkan dalam satu kontainer supaya variant/blink menumpuk pas ---
      if (eyeBaseKeys.has(key)) {
        if (!eyesAdded) {
          parent.addChild(this.eyes);
          eyesAdded = true;
        }
        this.eyes.addChild(sprite);
        continue;
      }

      // --- peran khusus + layer biasa ---
      if (key === this.roles.body) {
        this.body = sprite;
        // Napas: skala vertikal halus dari dasar badan -> pivot bawah-tengah.
        sprite.pivot.set(CANVAS.width / 2, CANVAS.height);
        sprite.position.set(CANVAS.width / 2, CANVAS.height);
      } else if (key === this.roles.mouth) {
        this.mouth = sprite;
      } else if (key === this.roles.bangs) {
        this.bangs = sprite;
        this.setPivot(sprite, hairPivots[key]?.pivot);
      } else if (key === this.roles.handLeft || key === this.roles.handRight) {
        // Poros di bahu (bila didaftarkan) supaya rotasi kecil berayun dari sana,
        // bukan dari pojok kanvas.
        const def = manifest.groups.hand_dynamic?.members[key];
        if (def) {
          this.setPivot(sprite, def.pivot);
          this.applyOffset(sprite, def.offset);
        }
        if (key === this.roles.handLeft) this.handLeft = sprite;
        else this.handRight = sprite;
      }
      parent.addChild(sprite);
    }

    this.wireEyes();
    this.root.pivot.set(CANVAS.width / 2, CANVAS.height / 2);
  }

  /** Pasang kontainer kepala ke root, poros di leher. */
  private addHead(manifest: Manifest): void {
    const hpv = manifest.groups.head_group.pivot;
    this.head.pivot.set(hpv[0], hpv[1]);
    this.head.position.set(hpv[0], hpv[1]);
    this.root.addChild(this.head);
  }

  /** Bikin layer mesh yang bisa diputar & dilengkungkan, lengkap dgn pengali per-layer. */
  private makeDeformPiece(key: string, def: DynamicMember, inHead: boolean): DeformPiece {
    const hair = makeHairMesh(this.tex(key), def.pivot);
    hair.mesh.label = key;
    this.applyOffset(hair.mesh, def.offset);
    return { hair, pivot: def.pivot, gain: def.gain ?? 1, bend: def.bend ?? 1, inHead };
  }

  /** Geser layer dari posisi kanvasnya (poros putar ikut bergeser bersamanya). */
  private applyOffset(node: { x: number; y: number }, offset?: Vec2): void {
    if (!offset) return;
    node.x += offset[0];
    node.y += offset[1];
  }

  /** Muat semua tekstur yang mungkin dipakai; yang 404 di-skip (bukan gagal-total). */
  private async loadTextures(manifest: Manifest): Promise<void> {
    const keys = new Set<string>(manifest.z_order_idle);
    manifest.eyes.base.forEach((k) => keys.add(k));
    Object.values(manifest.eyes.variants).forEach((k) => keys.add(k));
    Object.values(manifest.mouths).forEach((k) => keys.add(k));
    if (manifest.blink?.overlay) keys.add(manifest.blink.overlay);
    // Pupil khusus per-ekspresi (hati/spiral) — tak ada di z_order karena menumpang
    // di node pupil yang sama, jadi harus didaftarkan manual.
    for (const fx of Object.values(manifest.eyes.pupil_expressions ?? {})) {
      if (fx?.texture) keys.add(fx.texture.left), keys.add(fx.texture.right);
    }

    const missing: string[] = [];
    let firstError: unknown;
    await Promise.all(
      [...keys].map(async (k) => {
        try {
          this.textures.set(k, (await Assets.load(layerUrl(k))) as Texture);
        } catch (err) {
          missing.push(k);
          firstError ??= err;
        }
      }),
    );
    if (missing.length) {
      // Sertakan error aslinya: "file tak ada" dan "pemuat rusak" terlihat sama dari
      // luar, padahal perbaikannya beda total.
      console.warn(`[skin ${getSkin()}] ${missing.length} layer tak termuat, di-skip:`, missing, firstError);
    }
  }

  /** Peran inti wajib ada — kalau tidak, laporkan jelas (bukan blank misterius). */
  private assertCore(): void {
    const core = [this.roles.body, this.roles.headbase, this.roles.mouth, ...this.manifest.eyes.base];
    const gone = core.filter((k) => !this.textures.has(k));
    if (gone.length) {
      throw new Error(
        `Skin "${getSkin()}" tak lengkap — layer inti hilang: ${gone.join(', ')}.\n` +
          `Pastikan folder skin/${getSkin()}/ berisi file-file itu, atau pilih skin lain ` +
          `lewat menu. Cek cepat: node scripts/check-skins.mjs`,
      );
    }
  }

  /** Pasang referensi mata + node variant/blink di atas tumpukan mata. */
  private wireEyes(): void {
    const [bg, pupilL, pupilR, frame] = this.manifest.eyes.base;
    this.eyeBg = this.eyes.getChildByLabel(bg) as Sprite;
    this.pupilL = this.eyes.getChildByLabel(pupilL) as Sprite;
    this.pupilR = this.eyes.getChildByLabel(pupilR) as Sprite;
    this.eyeFrame = this.eyes.getChildByLabel(frame) as Sprite;

    // Poros pupil ditaruh di pusat pupil supaya bisa DIPERBESAR/DIPUTAR di tempat
    // (dipakai ekspresi pupil). Tanpa ini, skala akan menyeretnya ke pojok kanvas.
    const p = this.manifest.eyes.pupils;
    this.setPivot(this.pupilL, p.left.center);
    this.setPivot(this.pupilR, p.right.center);

    this.eyeVariant = new Sprite(); // tekstur di-set saat ganti state
    this.eyeVariant.visible = false;
    const blinkTex = this.textures.get(this.manifest.blink.overlay);
    this.eyeBlink = blinkTex ? new Sprite(blinkTex) : new Sprite();
    this.eyeBlink.visible = false;
    this.eyes.addChild(this.eyeVariant, this.eyeBlink);
  }
}
