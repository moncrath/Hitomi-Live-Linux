# Changelog

Semua perubahan penting proyek ini dicatat di sini.

## [Unreleased]
### Added
- **Hitomi Hub (opsional, KDE Plasma 6).** Widget panel di `plasma/` yang terpisah dari avatar:
  slider cahaya dan suara, toggle Wi-Fi dan Bluetooth, kecepatan jaringan, RAM/GPU/CPU, serta tab
  Working (sesi Claude Code beserta konteks terpakai), Services, dan CI. Dipasang dengan
  `plasma/install.sh` (hanya menulis ke `~/.local`, bisa dilepas dengan `--uninstall`). Ikon bawaannya
  roda gigi; `--avatar` memasang avatar maid telinga kucing (gambar buatan ChatGPT, all rights
  reserved, enam ukuran kecil sekitar 134 KB).
- **Paket Linux: AppImage dan deb.** `npm --prefix electron run pack` membuat keduanya di `release/`
  (electron-builder, konfigurasi di `electron/electron-builder.yml`). AppImage dipakai di distro apa pun;
  deb untuk Debian/Ubuntu dan masuk menu aplikasi. Bila dijalankan di Wayland tanpa flag, app
  meluncurkan ulang dirinya lewat XWayland, jadi AppImage tak perlu argumen.
- **Port Linux, Fase L1 (KDE Wayland).** Di Linux overlay kini dipaksa jalan lewat XWayland
  (`GDK_BACKEND=x11`, kecuali user sudah men-set sendiri). Dengan begitu posisi awal, always-on-top,
  dan tembus-klik bisa diandalkan. Posisi kursor global dibaca lewat `XQueryPointer` (crate `x11rb`,
  pure Rust), jadi tracking mata dan kepala tidak lagi diam di tengah. Batasnya, kursor membeku saat
  berada di atas window Wayland native. Build Windows tidak berubah.
- **Shell Electron untuk Linux** (`electron/`). Di mesin uji, WebKitGTK 2.52.5 tak bisa menggambar apa
  pun, bahkan di MiniBrowser polos, jadi Tauri di Linux buntu. Electron membawa Chromium sendiri.
  Isinya: window overlay, tray (tembus-klik + keluar), bridge hook di port 17872 dengan validasi yang
  sama persis dengan versi Rust, pemasang hook, dan kursor global. `dist/` disajikan lewat host
  `http://hitomi.localhost` yang dicegat di dalam proses, tanpa membuka port.
- **Lapisan `app/src/shell.ts`.** Frontend tak lagi memanggil API Tauri langsung, jadi kode yang sama
  jalan di Tauri, Electron, dan browser dev. `tauriCursor.ts` → `shellCursor.ts`,
  `bridge/tauriSignal.ts` → `bridge/shellSignal.ts`.
- **Tombol lingkaran "Tembus klik" di samping panah (Linux/Electron).** Ungu berarti Mati, hijau berarti
  Nyala. Saat Nyala, klik di tubuh Hitomi tembus ke window di belakangnya, dan lingkaran itu
  satu-satunya yang tetap bisa diklik, jadi Hitomi tak pernah terkunci. Ini diurus window kecil tak
  terlihat yang menempel di atas lingkaran. Sinkron dengan toggle di tray, default Mati tiap start, dan
  bisa dipakai lewat keyboard (Tab, Enter/Space, ring fokus pink). Dua versi sebelumnya (item di menu
  dengan deteksi kursor, lalu panah yang sekaligus membuka kunci) tidak pernah dirilis: yang pertama
  membuat menu ikut terkunci di Wayland, yang kedua terasa salah saat dipakai.

- **Lisensi.** Kode di bawah MIT (`LICENSE`); karya karakter Hitomi, gambar UI, dan ikon app tetap all
  rights reserved (`assets/LICENSE`).
- **README ditulis ulang untuk versi Linux**: cara menjalankan dari source, tombol tembus klik, tray,
  batas XWayland, dan pembagian lisensi.

### Fixed
- Gagal memuat layer avatar kini mencatat **error aslinya**. Dulu ditelan diam-diam, jadi "file tak
  ada" dan "pemuat rusak" terlihat sama persis.

### Changed
- **Font menu & bubble: Vividly → Itim** (SIL OFL 1.1). Lisensi dan asal Vividly tak tercatat, jadi
  tak aman didistribusikan. `size-adjust: 83%` menjaga lebar teks sama, sehingga tata letak tak bergeser.
- **`CLAUDE.md` dirapikan** jadi 12 seksi bernomor; blok prosa panjang (Lisensi & aset, Protokol drift)
  dipecah jadi sub-seksi berpoin, Standar Kode + Keamanan Kode digabung. Substansi aturan utuh
  (diverifikasi frasa-per-frasa terhadap versi sebelumnya) — yang berubah cuma keterbacaan.
- **Aturan smooth-scroll dicabut.** Dulu satu skill smooth-scroll wajib dibaca tiap kali ada scroll,
  bahkan cuma untuk memutuskan tidak memakainya — di tiga proyek terakhir itu bermasalah dan buang
  waktu. Sekarang: **default native scroll**, library smooth-scroll hanya bila diminta eksplisit.
  Larangan di UI baca/input (dashboard, form, tabel, feed) tetap berlaku.
- README: `CLAUDE.md` dijelaskan sebagai persona **+ ruleset engineering**, dan ikut didaftar di pohon repo.

### Removed
- **Api WebM ornamen kepala dibatalkan permanen** (dulu berstatus "ditunda"). Asetnya ternyata tak pernah
  ada di repo maupun riwayat git, dan user mengonfirmasi sudah tak dipakai. Kode memang sudah bersih
  (`AvatarRig.attachFire` tak ada lagi). Ornamen kepala final: `15a` (gerak) + `15b` (statis), tanpa api.
  Alasan teknis & jalur alternatif (sprite sheet, bukan video) dicatat di Decision Log Master State.

## [1.2.0] - 2026-08-02
### Added
- **Pemasang hook otomatis** (`src-tauri/src/hook_setup.rs`). Dulu ini satu-satunya langkah manual
  dan satu-satunya alasan orang gagal memakai Hitomi. Sekarang exe memasangnya sendiri saat start:
  - `notify.mjs` ke-bake dalam exe (`include_str!`) → ditulis ke `~/.claude/hooks/hitomi-notify.mjs`.
  - Enam event didaftarkan di `~/.claude/settings.json`.
  - **Non-destruktif**: hanya menyentuh entri miliknya sendiri; `permissions`, `model`, dan hook
    milik tool lain dibiarkan utuh. Backup ke `settings.json.bak` sebelum perubahan pertama.
  - **Idempoten**: dijalankan tiap start tapi hanya menulis bila memang beda (path dinormalkan ke
    garis miring biasa supaya tak menulis ulang settings hanya karena beda gaya path).
  - **Menyembuhkan diri**: entri lama yang menunjuk path berbeda diperbarui otomatis.
  - **Gagal dengan tenang**: `settings.json` rusak → tak ditimpa sama sekali, cuma dilaporkan.
  - Menghormati `CLAUDE_CONFIG_DIR` seperti Claude Code.
- Hitomi **melaporkan sendiri** hasilnya lewat bubble: senang saat hook baru dipasang, minder kalau
  Node.js tak terdeteksi. Diam saja kalau semuanya memang sudah beres.

### Changed
- README: langkah pakai tinggal unduh → klik dua kali → buka project. Blok JSON manual dihapus.

## [1.1.0] - 2026-08-02
### Added
- **Skin orisinal Hitomi** menggantikan Roccia (yang dihapus): maid gothic, telinga kelinci,
  bandana depan-belakang, ahoge, rantai berliontin. Kini satu-satunya skin & jadi default.
- **Rig data-driven**: nama layer bebas per-skin lewat `roles`; penempatan grup kepala
  ditentukan nomor layer (≥ 8 ikut kepala) — bukan lagi daftar hardcode.
  Opsi per-layer: `gain`, `bend`, `deform`, `offset`.
- **Fisika rambut**: pegas orde-2 + deformasi mesh (`MeshPlane`), lihat 1.1.0 Changed.
- **Ekspresi lewat pupil** (`PupilExpression`): skala, geser, getar, putar, denyut — semua
  prosedural per-state di manifest; plus tekstur pupil khusus (hati untuk `love`,
  spiral untuk `dizzy`). Eye-tracking **tetap hidup saat berekspresi**.
- **Gerak tangan** (`HandMotion`): ikut napas (selalu) + pose saat `ngoding`.
- Manifest luar dirapikan jadi **TEMPLATE** berdokumentasi untuk skin baru.

### Changed
- Rambut belakang tak lagi sprite kaku: `springStep` (pegas dgn kecepatan) menggantikan
  peredam orde-1 → melewati target lalu bergoyang; dirender sebagai `MeshPlane` (kisi 2×14)
  dengan vertex digeser sebanding kuadrat jarak dari pivot → pangkal diam, ujung melengkung.
  Dua pegas per potong (pangkal + ujung lembek); selisihnya = besar lengkungan.
- Aksesoris kepala kini diayun **searah** (terseret berlawanan gerak kepala), bukan mirror.
- Aksesoris jadi **jamak**: sayap/rantai/aksesoris kepala boleh berapa pun jumlahnya.
- `check-skins.mjs` memvalidasi terhadap manifest yang dipakai skin, bukan membandingkan
  ke skin lain (dulu melaporkan "avatar gagal" padahal jalan).

### Fixed
- Variant mata yang tak dimiliki skin dulu **menghilangkan mata** (wajah kosong); kini jatuh
  balik ke mata dasar dan tracking tetap jalan.
- Efek pupil membeku saat mata variant tampil lalu terbawa setelahnya (pupil normal ikut
  berputar setelah `dizzy`); kini di-reset saat variant tampil.
- Poros pupil dipindah ke pusat pupil — dulu di (0,0) kanvas, jadi membesar = terlempar ke pojok.
- Tangan terlempar ke atas kepala setelah porosnya dipindah ke bahu (posisi ditulis absolut,
  bukan relatif ke posisi diam).

### Added (dari sesi sebelumnya)
- **Interface renderer** (`app/src/renderer/`): `AvatarRenderer` (kontrak semantik — state, event,
  flash, talking, layout, update) + `PngRenderer` (implementasi rig PNG sekarang). Persiapan
  Live2D sebagai implementasi kedua di branch `live2d`.

### Changed
- **Fisika rambut jadi nyata (pegas + deformasi mesh).** Rambut belakang tak lagi sprite kaku:
  - `springStep` (pegas orde-2 dgn kecepatan) menggantikan peredam orde-1 → rambut **melewati
    target lalu bergoyang** sebelum diam, bukan sekadar meluncur.
  - Rambut dirender sebagai `MeshPlane` (kisi 2×14). Tiap baris vertex digeser sebanding
    **kuadrat** jarak dari pivot → pangkal diam, ujung melengkung.
  - Dua pegas per potong (pangkal + ujung yg lebih lembek); selisihnya = besar lengkungan,
    jadi rambut melengkung saat bergerak & lurus sendiri saat diam.
  - Terukur: puncak lengkung ~154px, 57 fps, tanpa artefak. Tuning di `TUNING.hair`.
- **Polish bubble teks:** ekor bubble (segitiga ber-outline pink) menunjuk ke arah kepala avatar,
  ikut sisi kiri/kanan; animasi muncul pakai pop overshoot dengan titik tumpu di pangkal ekor.
- Bubble kini juga di-mount saat dev di browser; DevPanel dapat tombol **"bubble teks"** untuk
  memicunya (sebelumnya cuma bisa diuji lewat overlay Tauri).

## [1.0.0] - 2026-07-30
### Added
- Inisialisasi proyek: folder, `CLAUDE.md` (persona Hitomi), docs planning.
- Master State dengan arsitektur, scope (Fase 1+2, no TTS), dan Decision Log awal.
- **Fase 1a — scaffold renderer** (`app/`): Vite + TypeScript strict + pixi.js v8.
  - Loader `manifest.json` → `AvatarRig` menyusun 33 layer jadi scene ber-grup (head / hair / static).
  - Animasi prosedural: blink, eye-tracking (pupil base), head-tilt 2.5D + parallax, hair-sway (spring-lag), napas badan.
  - `StateController` (swap mata/mulut per state + peta event hook) + `DevPanel` tombol debug.
  - `vite.config.ts` `publicDir` → `../assets` (aset dilayani tanpa duplikasi).
- **Aksesoris bergerak** (aset user baru):
  - Sayap `1a`/`1b` (pecah kiri-kanan) — `WingFlap`: flap idle mirror + condong ikut kepala.
  - Aksesoris baju `7b` — `ClothSway`: pendulum halus gain kecil.
  - Aksesoris kepala dipisah: `15b` statis + `15a` plume — `HeadAccessorySway` (trailing relatif).
  - Manifest: grup `back_dynamic` / `cloth_dynamic` / `head_accessory_dynamic`.
- **Fase 1b — jembatan event (bridge + hooks):**
  - WS bridge lokal (`bridge/`, port 17872): `POST /event` → broadcast `WS /ws`; relay-nama murni + validasi ketat (regex, cap panjang), tak pernah eksekusi apa pun.
  - Hook poster `hooks/notify.mjs` fire-and-forget (timeout 400ms, selalu exit 0 → tak pernah blok Claude Code).
  - Client overlay `BridgeClient` auto-reconnect, di-wire di `main.ts`. **Terverifikasi end-to-end di Antigravity** (notif hook kepanggil beneran).
- **Fase 1c — shell overlay Tauri** (`app/src-tauri/`, Tauri v2 + Rust):
  - Window **frameless, transparan, always-on-top** yang mengambang di desktop; bootstrap **bertahap dari window normal** demi keamanan (lihat catatan).
  - **Tracking kursor global** via command `cursor_norm` (`windows` crate `GetCursorPos`) + poller frontend → eye/head-tracking tetap jalan walau overlay **tembus-klik**.
  - **Tray** (Keluar + toggle tembus-klik) sebagai kontrol utama + tombol darurat. **Drag** window via `startDragging` (+ permission `core:window:allow-start-dragging`).
  - **Menu Hitomi in-app**: ikon panah flip (arrow.png) + panel (fill `#3e2271`, border `#fab3df`, teks putih, font **Vividly**); **grid tombol ukuran 1–10**; toggle **sisi bubble** (kanan/kiri).
  - Command `resize_overlay` (rasio 3:4, anchor tengah menghormati posisi drag).

- **Fase 2 — bubble teks** (0 token, no TTS):
  - `notify.mjs` pada hook `Stop`: baca `transcript_path` `.jsonl` → ambil **kalimat terakhir Hitomi** (assistant terakhir yg ada teks; strip markdown ringan; cap 180 char) → POST `/bubble`.
  - Rust bridge: endpoint `POST /bubble` (body ≤4KB, teks ≤600 char) → emit event Tauri `hitomi://bubble`.
  - `HitomiBubble` overlay: panel teks (ungu/pink, font Vividly) muncul di sisi sesuai `hitomi.bubbleSide`, auto-hilang (durasi ikut panjang teks).
- **Polish ekspresi:** animasi "ngomong" saat bubble tampil (`TalkAnim`: mata dipaksa `closed_happy` sepanjang durasi + mulut gantian `9aa`/`9ab`); **idle emote** sesekali (love/senang/minder) via `IdleEmote`; **mood error** (`coding_error`→dizzy, `error_streak`≥3→marah, dideteksi di `notify.mjs`); **bubble "thinking"** (`ThinkingBubble`, pixi) muncul saat mikir/ngoding dgn ikon berputar, mirror ikut sisi.
- **Ganti skin karakter** (menu → *Skin*): tekstur dipisah per-skin di `skin/<id>/`, dipilih data-driven dari `skins.json`; ganti skin → simpan `hitomi.skin` + reload. **Fleksibel:** tiap skin boleh punya `skin/<id>/manifest.json` sendiri (geometri/pivot beda per karakter) — fallback ke manifest bersama bila tak ada. **Rig toleran:** cuma layer inti wajib; layer opsional yang hilang di-skip (bukan crash), jadi skin boleh beda jumlah file. Skrip `scripts/check-skins.mjs` cek kelengkapan (inti ✖ / opsional ⚠).

### Changed
- **Portable build + auto-hook global:** `tauri build --no-bundle` → **satu exe self-contained** (`app/src-tauri/target/release/app.exe`, frontend+aset ke-embed). Icon dari `app-icon.png` (di-pad 1024²). Hook dijadikan **global** di `~/.claude/settings.json` (script stabil `~/.claude/hooks/hitomi-notify.mjs`) → semua project auto-bereaksi tanpa setup, cukup jalankan 1 exe. Hook per-project repo ini dikosongkan (cegah dobel-fire). Cakupan: **universal** (bereaksi di semua sesi Claude Code; kontrol via nyala/mati exe).
- **Aset direstruktur untuk multi-skin:** `assets/avatar/hitomi/layers/` → `assets/avatar/hitomi/skin/Roccia/` (skin sekarang = **Roccia**, Wuthering Waves; sementara sampai skin orisinal Hitomi siap). `config.layerUrl` kini pakai skin aktif; tambah `skins.json`.
- **Ekspresi lebih hidup:** `mikir` & `ngoding` kini beda dari `idle` (mata tetap base → tracking jalan). Mulut **random gantian**: mikir = `pout`/`bleeh`, ngoding = `happy1`/`frawl` (aset `9j`,`9k` didaftarkan). Durasi flash `sukses`/`love` 0.9s → **1.6s**. `StateDef.mouths[]` = pool mulut acak.
- **Bridge diserap ke dalam overlay (Rust `tiny_http`)** — hook POST `127.0.0.1:17872/event` → emit event Tauri `hitomi://signal` → avatar. Tujuan: launch overlay = semua jalan, 1 exe mandiri tanpa Node. Frontend Tauri pakai `listen()`; browser-dev tetap WS (`bridge/` Node opsional). Bind retry 10× (tahan race port saat hot-reload dev).
- **Eye-tracking jadi look-at akurat** — pupil menatap TITIK kursor (per mata, via `eyes.toGlobal` + kursor relatif window `cursor_norm` uv), bukan sekadar condong relatif layar.
- `TUNING.fitScale` 0.95 → **0.82** (beri margin di window supaya rambut/parallax tak kepotong di tepi).
- Font UI: Komika (`KOMIKAX_.ttf`) → **Vividly** (`Vividly-Regular.ttf`, 100% free). Aset UI dipindah ke `assets/ui/`.

### Deferred
- **Api WebM (ornamen kepala) ditunda.** Sempat diimplementasi (luma-key VP9 alpha + additive + autoplay hardening) tapi video nggak konsisten nongol di browser user → dicabut biar nggak menghambat.
  > **Koreksi 2026-09-12:** klaim "aset `15c_head_accessories.webm` disimpan" di baris ini **salah** — file itu tak pernah ada di repo maupun riwayat git. Fitur kini **dibatalkan permanen** (aset tak dipakai lagi, dikonfirmasi user). Duduk perkaranya di Decision Log Master State.

### Notes
- 2026-07-28 — Proyek dibuat sebagai repo terpisah dari `Hitomi_Claude`. Pilihan avatar: PNGtuber 2.5D. Nunggu aset seni berlayer dari user.
