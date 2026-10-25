# Hitomi Live — App (renderer)

Renderer avatar PNGtuber 2.5D (Fase 1a). Vite + TypeScript + pixi.js v8.

## Jalankan
```bash
cd app
npm install      # sekali, ambil pixi.js + vite
npm run dev      # http://127.0.0.1:5173
```

Aset seni dilayani dari `../assets` lewat `publicDir` (lihat `vite.config.ts`) —
tak ada duplikasi PNG; URL runtime `/avatar/hitomi/...`.

## Struktur
- `src/config.ts` — path aset + tuning animasi terpusat.
- `src/manifest.ts` + `src/types.ts` — muat & tipe `manifest.json`.
- `src/rig/AvatarRig.ts` — susun 33 layer jadi scene ber-grup (head / hair / static).
- `src/anim/*` — blink · eyeTracking · headTilt (2.5D) · hairSway · breathing.
- `src/state/StateController.ts` — swap mata/mulut per state + peta event hook.
- `src/ui/DevPanel.ts` — panel tombol state/event untuk debug.
- `src/main.ts` — bootstrap pixi + loop ticker.

Console: `window.hitomi` = `{ app, rig, state }`.

## Skrip
- `npm run dev` — dev server.
- `npm run build` — typecheck (`tsc --noEmit`) + build produksi.
- `npm run typecheck` — cek tipe saja.

Status: Fase 1b & 1c **selesai** — shell Tauri (transparan, always-on-top, click-through),
bridge in-process (Rust `tiny_http`), dan hooks Claude Code global sudah jalan.
Overlay IDE-agnostic: sinyal dari `~/.claude/settings.json`, bukan API IDE.
