import { MeshPlane, type Texture } from 'pixi.js';
import { CANVAS } from '../config';
import type { Vec2 } from '../types';

/**
 * Rambut sebagai MESH, bukan sprite kaku — supaya bisa **dilengkungkan**, bukan
 * sekadar diputar. Ini "Live2D orang miskin": deformasi nyata di atas PNG yang
 * sudah ada, tanpa rigging dan tanpa aset baru.
 *
 * Cara kerjanya: sprite dipasangi kisi vertex; tiap baris vertex digeser
 * horizontal sebanding kuadrat jaraknya dari pivot (pangkal rambut). Pangkal
 * praktis diam, ujung bergerak paling jauh → kurva melengkung alami, bukan
 * miring seragam.
 */

// Kisi cukup rapat vertikal (kurva halus) & minimal horizontal (pergeseran per
// baris seragam, jadi kolom banyak tak menambah apa pun selain beban).
const COLS = 2;
const ROWS = 14;

export interface HairMesh {
  mesh: MeshPlane;
  /** Posisi vertex asli — acuan tiap frame supaya deformasi tak menumpuk. */
  rest: Float32Array;
  /** Bobot lengkung per vertex (0 di pangkal, 1 di ujung). */
  weights: Float32Array;
}

/** Bangun mesh rambut dari tekstur layer, dengan poros di `pivot`. */
export function makeHairMesh(texture: Texture, pivot: Vec2): HairMesh {
  const mesh = new MeshPlane({ texture, verticesX: COLS, verticesY: ROWS });
  // Sama seperti sprite rambut: pivot == position agar diam saat rotasi 0.
  mesh.pivot.set(pivot[0], pivot[1]);
  mesh.position.set(pivot[0], pivot[1]);

  const positions = mesh.geometry.getBuffer('aPosition').data as Float32Array;
  const rest = Float32Array.from(positions);

  // Bobot: 0 di atas pivot (rambut nempel kepala, tak boleh geser), lalu naik
  // kuadratik ke bawah. Kuadratik dipilih supaya lengkungnya melengkung —
  // linier akan terlihat seperti miring lurus.
  const span = Math.max(1, CANVAS.height - pivot[1]);
  const weights = new Float32Array(rest.length / 2);
  for (let i = 0; i < weights.length; i++) {
    const y = rest[i * 2 + 1];
    const t = Math.max(0, (y - pivot[1]) / span);
    weights[i] = t * t;
  }

  return { mesh, rest, weights };
}

/** Lengkungkan mesh sejauh `bend` piksel di ujungnya (boleh negatif). */
export function bendHairMesh(hm: HairMesh, bend: number): void {
  const buffer = hm.mesh.geometry.getBuffer('aPosition');
  const pos = buffer.data as Float32Array;
  for (let i = 0; i < hm.weights.length; i++) {
    pos[i * 2] = hm.rest[i * 2] + bend * hm.weights[i];
  }
  buffer.update();
}
