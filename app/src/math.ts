export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Damping frame-rate independent menuju target.
 * `smoothing` = fraksi jarak yang MASIH tersisa setelah 1 detik (0<..<1).
 * dt dalam detik.
 */
export const damp = (current: number, target: number, smoothing: number, dt: number): number =>
  lerp(current, target, 1 - Math.pow(smoothing, dt));

/** Keadaan pegas orde-2 (punya kecepatan, jadi bisa melewati target lalu balik). */
export interface Spring {
  value: number;
  vel: number;
}

export const makeSpring = (value = 0): Spring => ({ value, vel: 0 });

/**
 * Satu langkah pegas teredam. Beda dari `damp` yang cuma meluncur ke target dan
 * berhenti: ini menyimpan kecepatan, jadi **melewati target lalu bergoyang** —
 * itulah yang bikin rambut terasa punya berat.
 *
 * @param stiffness Kekakuan (makin besar makin cepat & makin sering bergoyang).
 * @param damping   Fraksi KECEPATAN yang tersisa setelah 1 detik (0<..<1);
 *                  makin kecil makin cepat diam. Konvensi sama dengan `smoothing`.
 */
export const springStep = (
  s: Spring,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): number => {
  s.vel += (target - s.value) * stiffness * dt;
  s.vel *= Math.pow(damping, dt);
  s.value += s.vel * dt;
  return s.value;
};
