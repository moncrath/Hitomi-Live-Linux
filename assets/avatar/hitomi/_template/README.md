# Hitomi — Template Aset Avatar

Kanvas seragam **1080 × 1440 px**, PNG-32 (RGBA), transparan. Semua layer digambar
di kanvas ini pada posisi finalnya → tumpukan otomatis pas (registration sempurna).

## Isi folder
- `canvas_blank.png` — kanvas transparan murni. **Duplikat ini** sebagai dasar tiap layer.
- `layout_guide.png` — peta posisi layer + **pivot** (titik merah) + safe margin. Referensi, jangan digambari.
- `expression_guide.png` — slot varian alis & mulut + state map.
- `generate_templates.py` — generator (jalankan ulang bila spec berubah).
- `../layers/*.png` — blank per-layer siap digambar (sudah dinamai benar).
- `../avatar-spec.json` — spesifikasi terkunci (dibaca engine).

## Aturan menggambar
1. Buka `layout_guide.png` sebagai layer referensi paling atas (turunkan opacity).
2. Gambar tiap bagian di file `../layers/<nama>.png` sesuai kotak & posisinya.
3. Jaga isi tetap di dalam **safe margin** (garis putus merah).
4. **Pivot (titik merah)** = poros animasi. Contoh: akar rambut, pangkal leher.
   Pastikan bagian yang berporos di situ benar-benar menyentuh titik itu.
5. Ekspor tetap di kanvas 1080×1440 (jangan di-crop / trim).

## Mata (penting)
- `eyes_open.png` = putih mata + garis kelopak, **tanpa pupil** (dipakai sebagai mask).
- `pupils.png` = 2 pupil dalam 1 file (gerak sinkron ikut kursor).
- `eyes_closed.png` = garis kelopak tertutup (frame kedip).

## Varian ekspresi (file terpisah)
- Alis: `brows_neutral`, `brows_raised`, `brows_worried`, `brows_angry`
- Mulut: `mouth_neutral`, `mouth_smile`, `mouth_open`, `mouth_flat`, `mouth_frown`, `mouth_wavy`
- State: idle · mikir · ngoding · sukses · error · **marah** · **minder** (lihat state map).

Opsional: `blush`, `arm_front`, `arm_back`.
