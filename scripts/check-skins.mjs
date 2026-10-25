#!/usr/bin/env node
/**
 * Cek kelengkapan skin avatar — MENGIKUTI MANIFEST, bukan membandingkan ke skin lain.
 *
 * Tiap skin boleh punya `skin/<id>/manifest.json` sendiri (nama layer & aksesorisnya
 * bebas); yang tak punya memakai manifest bersama. Jadi acuan yang benar adalah
 * manifest yang dipakai skin itu, bukan daftar file skin tetangga.
 *
 * Aturan sama persis dengan `AvatarRig`:
 *   - INTI (✖ avatar gagal): roles.body, roles.headbase, roles.mouth, dan eyes.base[]
 *   - OPSIONAL (⚠ di-skip saat render): layer lain yang disebut manifest
 *   - EKSTRA (info): file PNG yang ada di folder tapi tak pernah disebut manifest
 *     -> ini biasanya berarti kamu lupa memasukkannya ke z_order_idle.
 *
 * Jalankan:  node scripts/check-skins.mjs
 * Exit code 1 hanya bila ada skin yang kurang layer INTI.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AVATAR_DIR = join(ROOT, 'assets', 'avatar', 'hitomi');
const SKIN_DIR = join(AVATAR_DIR, 'skin');

// Sinkron dgn DEFAULT_ROLES di app/src/rig/AvatarRig.ts.
const DEFAULT_ROLES = {
  body: '7_body',
  headbase: '8_headbase',
  mouth: '9b_mouth_closed',
  bangs: '12_bangs',
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pngs = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort() : null;

const sharedManifest = readJson(join(AVATAR_DIR, 'manifest.json'));

let ids;
try {
  ids = readJson(join(AVATAR_DIR, 'skins.json')).skins.map((s) => s.id);
} catch {
  ids = readdirSync(SKIN_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

let hasMissing = false;

for (const id of ids) {
  const dir = join(SKIN_DIR, id);
  const files = pngs(dir);
  if (files === null) {
    console.log(`✖ ${id}: folder skin/${id}/ tidak ada`);
    hasMissing = true;
    continue;
  }

  const ownManifest = join(dir, 'manifest.json');
  const usesOwn = existsSync(ownManifest);
  const m = usesOwn ? readJson(ownManifest) : sharedManifest;
  const roles = { ...DEFAULT_ROLES, ...(m.roles ?? {}) };

  const core = [roles.body, roles.headbase, roles.mouth, ...m.eyes.base];
  const referenced = new Set([
    ...m.z_order_idle,
    ...m.eyes.base,
    ...Object.values(m.eyes.variants ?? {}),
    ...Object.values(m.mouths ?? {}),
    ...(m.blink?.overlay ? [m.blink.overlay] : []),
    // Pupil khusus per-ekspresi: menumpang di node pupil, jadi tak muncul di z_order.
    ...Object.values(m.eyes.pupil_expressions ?? {}).flatMap((fx) =>
      fx?.texture ? [fx.texture.left, fx.texture.right] : [],
    ),
  ]);

  const have = new Set(files.map((f) => f.slice(0, -4)));
  const coreMissing = core.filter((k) => !have.has(k));
  const optMissing = [...referenced].filter((k) => !have.has(k) && !core.includes(k)).sort();
  const extra = [...have].filter((k) => !referenced.has(k)).sort();

  const src = usesOwn ? 'manifest sendiri' : 'manifest bersama';
  if (coreMissing.length) {
    hasMissing = true;
    console.log(`✖ ${id} (${src}): KURANG ${coreMissing.length} layer INTI — avatar gagal dimuat:`);
    for (const k of coreMissing) console.log(`    - ${k}.png  [inti]`);
  } else if (optMissing.length) {
    console.log(`⚠ ${id} (${src}): inti lengkap, ${optMissing.length} opsional belum ada (di-skip saat render):`);
    for (const k of optMissing) console.log(`    - ${k}.png`);
  } else {
    console.log(`✔ ${id} (${src}): lengkap — ${files.length} file, semua dipakai`);
  }
  if (extra.length) {
    console.log(`    ${extra.length} file tak disebut manifest (tak akan tampil): ${extra.join(', ')}`);
  }
}

console.log('');
process.exit(hasMissing ? 1 : 0);
