import { MANIFEST_URL, skinManifestUrl, getSkin } from './config';
import type { Manifest } from './types';

/** Ambil JSON bila benar-benar JSON. Vite dev mengembalikan `index.html` (200,
 *  text/html) untuk path tak ada → cek content-type biar tak salah kira "ada". */
async function fetchJson(url: string): Promise<Manifest | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  if (!(res.headers.get('content-type') || '').includes('json')) return null;
  try {
    return (await res.json()) as Manifest;
  } catch {
    return null;
  }
}

/** Manifest skin aktif bila ada, jika tidak pakai template bersama (`MANIFEST_URL`). */
export async function loadManifest(): Promise<Manifest> {
  const m = (await fetchJson(skinManifestUrl())) ?? (await fetchJson(MANIFEST_URL));
  if (!m) throw new Error(`Gagal muat manifest (skin "${getSkin()}" & fallback tak ada/rusak)`);
  return m;
}
