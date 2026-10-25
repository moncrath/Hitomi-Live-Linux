// Path aset. Dilayani lewat publicDir (../assets) => root URL.
export const AVATAR = 'hitomi';
export const DEFAULT_SKIN = 'Hitomi';
export const MANIFEST_URL = `/avatar/${AVATAR}/manifest.json`; // template/fallback bersama
export const SKINS_URL = `/avatar/${AVATAR}/skins.json`;

/**
 * Skin aktif. Hitomi satu-satunya karakter, jadi ini KONSTAN — bukan pilihan.
 *
 * Dulu tersimpan di localStorage lewat menu. Itu jadi jebakan: localStorage
 * overlay Tauri terpisah dari browser, jadi begitu skin lama dihapus dari aset,
 * exe yang pernah dipakai tetap meminta skin itu dan gagal dengan "layer inti
 * hilang". Tanpa pilihan, tak ada pilihan basi yang bisa tertinggal.
 */
export const getSkin = (): string => DEFAULT_SKIN;

/** Manifest KHUSUS skin (opsional). Bila ada → geometri/pivot/z-order milik skin itu
 *  sendiri (karakter beda bentuk). Bila tak ada → pakai `MANIFEST_URL` bersama. */
export const skinManifestUrl = (): string => `/avatar/${AVATAR}/skin/${getSkin()}/manifest.json`;

/** URL PNG dari key layer utk skin aktif, mis. "8_headbase" -> /avatar/hitomi/skin/Roccia/8_headbase.png */
export const layerUrl = (key: string): string => `/avatar/${AVATAR}/skin/${getSkin()}/${key}.png`;

// Kanvas seragam semua layer (registrasi presisi, tanpa offset manual).
export const CANVAS = { width: 1080, height: 1440 } as const;

// Bridge lokal (hook Claude Code -> event). Overlay konek ke sini via WebSocket.
export const BRIDGE_URL = 'ws://127.0.0.1:17872/ws';

// Tuning animasi terpusat (smoothing = fraksi jarak TERSISA setelah 1 detik;
// makin kecil makin gesit, makin besar makin ngelag).
export const TUNING = {
  head: { smoothing: 0.0009, maxRot: 0.12, parallaxX: 16, parallaxY: 9 },
  // Rambut belakang = pegas orde-2 (melewati target lalu bergoyang), plus lengkungan
  // mesh: ujung rambut punya pegas KEDUA yang lebih lembek sehingga tertinggal dari
  // pangkalnya -> selisihnya jadi besar lengkungan.
  hair: {
    stiffness: 70,
    damping: 0.12,
    gain: 1.7,
    tipStiffness: 26, // ujung lebih lembek dari pangkal
    tipDamping: 0.2,
    // px pergeseran ujung per radian selisih pangkal-ujung (kanvas 1080x1440).
    // 650 => puncak ~145px saat kursor dilempar dari tepi ke tepi; terasa berat tapi tak lebay.
    bendPixels: 650,
  },
  bangs: { smoothing: 0.16, gain: 0.75 },
  // Look-at mata: reach = fraksi ukuran avatar; kursor sejauh ~reach dari mata = deflect penuh.
  eyes: { smoothing: 0.0035, reach: 0.5 },
  breath: { speed: 1.6, amount: 0.012 },
  // Tangan (1 layer per sisi, tanpa siku): geser vertikal saja. Amplitudo sengaja
  // kecil — makin besar makin kelihatan bahwa lengannya kaku.
  hands: {
    breathAmp: 5, // px naik-turun mengikuti napas
    breathSmoothing: 0.25, // lag terhadap dada (0 = ikut persis)
    // Pose "malu-malu" saat ngoding: ditahan, bukan bergetar — getar berfrekuensi
    // tetap terasa seperti robot (sudah dicoba & dibuang).
    // rad. POSITIF = merapat ke dalam, NEGATIF = mengayun keluar (dicerminkan
    // otomatis untuk tangan kanan). Nilai sekarang menyembunyikan tangan di balik
    // badan saat ngoding — dipilih user setelah mencoba beberapa sudut.
    shyRotation: -0.5,
    shyLift: 7, // px terangkat sedikit
    poseSmoothing: 0.02, // kecepatan masuk/keluar pose (kecil = gesit)
  },
  // Sayap belakang bawah: flap idle (sine, mirror kiri-kanan) + condong ikut kepala.
  wings: { idleSpeed: 1.0, idleAmp: 0.05, reactGain: 0.5, smoothing: 0.25, dropY: 140 },
  // Aksesoris baju: pendulum halus (ga lebay).
  cloth: { idleSpeed: 0.8, idleAmp: 0.02, gain: 0.45, smoothing: 0.3 },
  // Plume kepala (15a): sway trailing di dalam head (rotasi relatif ke kepala).
  headAcc: { gain: 2.4, smoothing: 0.35 },
  dropY: 26, // geser kepala + rambut belakang turun (nutup potongan leher)
  // <1 memberi margin di dalam window supaya rambut/parallax tak kepotong di tepi.
  fitScale: 0.82,
} as const;
