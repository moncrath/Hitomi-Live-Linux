// Bentuk manifest.json (hanya field yang dipakai renderer).
export type Vec2 = [number, number];

export interface StateDef {
  eyes: string; // "base" | key variant (closed_happy, shocked, angry, sad, dizzy, love, ...)
  mouth?: string; // key ke mouths (tunggal)
  mouths?: string[]; // atau kumpulan key -> dipilih acak tiap state di-apply (variasi)
  tracking: boolean;
  note?: string;
}

export interface EventDef {
  flash?: string; // state sekejap
  then?: string; // balik ke state ini setelah flash
  state?: string; // set state permanen
  on_error?: string;
  note?: string;
}

/**
 * Nama layer yang punya PERAN khusus di rig (dipakai animasi). Per-skin boleh beda
 * nama file — cukup timpa di sini, tak perlu ubah kode. Yang tak disebut memakai
 * nama bawaan (konvensi skin Roccia).
 */
/** Satu layer yang bergerak. `pivot` = titik nempel (poros putar & pangkal lengkung). */
export interface DynamicMember {
  pivot: Vec2;
  /** Pengali kekuatan gerak khusus layer ini (1 = normal). Mis. rambut pendek → 0.3. */
  gain?: number;
  /** Pengali besar lengkungan mesh (1 = normal, 0 = kaku). */
  bend?: number;
  /** Render sebagai mesh yang bisa melengkung. Default: ya untuk rambut, tidak untuk sisanya. */
  deform?: boolean;
  /** Geser layer ini [dx, dy] px tanpa ekspor ulang aset — untuk merapikan posisi. */
  offset?: Vec2;
}

/** Efek pupil per-state (prosedural — tanpa aset tambahan). */
export interface PupilFx {
  scale?: number; // 1 = normal; <1 mengecil (kaget/marah), >1 membesar (love/fokus)
  offsetX?: number; // px di kanvas; + = melirik ke kanan
  offsetY?: number; // + = melihat ke bawah
  shake?: number; // amplitudo getar acak (px) — kesan gemetar/kaget
  spin?: number; // rad/detik (mis. pupil spiral saat pusing)
  pulse?: number; // amplitudo denyut skala (mis. jantung berdebar saat love)
  /** Tekstur pupil khusus (mis. hati/spiral). Tak disebut = pakai pupil normal. */
  texture?: { left: string; right: string };
}

export interface Roles {
  body?: string; // dipakai napas
  headbase?: string; // wajib ada (inti kepala)
  mouth?: string; // node mulut default; teksturnya di-swap saat ganti state
  bangs?: string; // poni (sway sendiri, lebih kaku dari rambut belakang)
  handLeft?: string; // tangan kiri — ikut napas & animasi mengetik
  handRight?: string;
}

export interface Manifest {
  name: string;
  canvas: { width: number; height: number };
  z_order_idle: string[];
  roles?: Roles;
  groups: {
    // head_group WAJIB (poros kepala inti); grup dinamis lain opsional per-skin
    // (karakter tanpa sayap/cloth/plume cukup tak mencantumkannya).
    head_group: { pivot: Vec2; members: string[]; note?: string };
    hair_dynamic?: { note?: string; members: Record<string, DynamicMember> };
    back_dynamic?: { note?: string; members: Record<string, DynamicMember> };
    cloth_dynamic?: { note?: string; members: Record<string, DynamicMember> };
    head_accessory_dynamic?: { note?: string; members: Record<string, DynamicMember> };
    /** Tangan: `pivot` di titik bahu supaya rotasi kecil berporos di sana. */
    hand_dynamic?: { note?: string; members: Record<string, DynamicMember> };
    static?: { note?: string; members: string[] };
  };
  eyes: {
    base: string[];
    pupils: {
      left: { file: string; center: Vec2 };
      right: { file: string; center: Vec2 };
      max_offset: Vec2;
    };
    variants: Record<string, string>;
    /** Ekspresi pupil per nama state. Yang tak disebut = pupil normal. */
    pupil_expressions?: Record<string, PupilFx>;
  };
  mouths: Record<string, string>;
  brows: { left: string; right: string; static: boolean };
  tracking: Record<string, unknown>;
  states: Record<string, StateDef>;
  blink: { overlay: string; only_when: string; interval_ms: Vec2; duration_ms: number };
  events: Record<string, EventDef>;
  bubble: Record<string, unknown>;
}
