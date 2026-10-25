mod hook_setup;

use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use tiny_http::{Method, Response, Server, StatusCode};

// --- Bridge in-process (dulu proses Node terpisah di `bridge/`) ---
// Hook Claude Code POST {kind,name} ke http://127.0.0.1:17872/event → di-emit
// ke webview sebagai event Tauri `hitomi://signal`. Relay-nama murni + validasi
// ketat, TAK PERNAH eksekusi apa pun (identik kontrak bridge Node lama).
const BRIDGE_ADDR: &str = "127.0.0.1:17872";
const MAX_NAME: usize = 48;
const MAX_BODY: usize = 1024;
const MAX_BUBBLE_BODY: usize = 4096;
const MAX_BUBBLE_TEXT: usize = 600;

#[derive(Clone, Serialize)]
struct Signal {
    kind: String,
    name: String,
}

#[derive(Clone, Serialize)]
struct BubblePayload {
    text: String,
}

fn parse_bubble(raw: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let text = v.get("text")?.as_str()?.trim();
    if text.is_empty() {
        return None;
    }
    Some(text.chars().take(MAX_BUBBLE_TEXT).collect())
}

fn read_capped(request: &mut tiny_http::Request, cap: usize) -> String {
    let mut body = String::new();
    let mut limited = request.as_reader().take((cap + 1) as u64);
    let _ = limited.read_to_string(&mut body);
    body
}

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_NAME
        && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn parse_signal(raw: &str) -> Option<Signal> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let kind = v.get("kind")?.as_str()?;
    if kind != "event" && kind != "state" {
        return None;
    }
    let name = v.get("name")?.as_str()?;
    if !valid_name(name) {
        return None;
    }
    Some(Signal {
        kind: kind.to_string(),
        name: name.to_string(),
    })
}

fn start_bridge(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        // Retry bind: saat hot-reload dev, instance lama bisa masih pegang port sebentar.
        let mut server = None;
        for attempt in 1..=10 {
            match Server::http(BRIDGE_ADDR) {
                Ok(s) => {
                    server = Some(s);
                    break;
                }
                Err(e) => {
                    log::warn!("[bridge] listen {BRIDGE_ADDR} gagal (coba {attempt}/10): {e}");
                    std::thread::sleep(std::time::Duration::from_millis(400));
                }
            }
        }
        let Some(server) = server else {
            log::error!("[bridge] menyerah listen {BRIDGE_ADDR}");
            return;
        };
        log::info!("[bridge] siap di http://{BRIDGE_ADDR} (POST /event)");
        for mut request in server.incoming_requests() {
            let method = request.method().clone();
            let url = request.url().to_string();

            if method == Method::Get && url == "/" {
                let _ = request.respond(Response::from_string("{\"ok\":true}"));
                continue;
            }

            if method == Method::Post && url == "/event" {
                let body = read_capped(&mut request, MAX_BODY);
                if body.len() > MAX_BODY {
                    let _ = request.respond(Response::empty(StatusCode(413)));
                    continue;
                }
                match parse_signal(&body) {
                    Some(sig) => {
                        let _ = app.emit("hitomi://signal", sig);
                        let _ = request.respond(Response::from_string("{\"ok\":true}"));
                    }
                    None => {
                        let _ = request
                            .respond(Response::from_string("{\"ok\":false}").with_status_code(400));
                    }
                }
            } else if method == Method::Post && url == "/bubble" {
                let body = read_capped(&mut request, MAX_BUBBLE_BODY);
                if body.len() > MAX_BUBBLE_BODY {
                    let _ = request.respond(Response::empty(StatusCode(413)));
                    continue;
                }
                match parse_bubble(&body) {
                    Some(text) => {
                        let _ = app.emit("hitomi://bubble", BubblePayload { text });
                        let _ = request.respond(Response::from_string("{\"ok\":true}"));
                    }
                    None => {
                        let _ = request
                            .respond(Response::from_string("{\"ok\":false}").with_status_code(400));
                    }
                }
            } else {
                let _ = request.respond(Response::empty(StatusCode(404)));
            }
        }
    });
}

/// Status tembus-klik saat ini (default OFF supaya window bisa diseret & menu bisa diklik).
static CLICK_THROUGH: AtomicBool = AtomicBool::new(false);

/// Posisi kursor GLOBAL dinormalisasi ke -1..1 relatif ukuran layar primer.
/// Dipakai frontend untuk eye/head-tracking (tetap jalan saat tembus-klik).
/// Posisi kursor untuk tracking. Mengembalikan 4 nilai:
/// - `sx, sy`  : -1..1 relatif LAYAR (dipakai head-tilt/parallax).
/// - `wu, wv`  : 0..1 posisi kursor di dalam WINDOW (dipakai look-at mata: arah
///               dari mata ke kursor jadi akurat walau window ada di pojok mana pun).
#[cfg(windows)]
#[tauri::command]
fn cursor_norm(win: tauri::WebviewWindow) -> (f64, f64, f64, f64) {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetCursorPos, GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN,
    };
    unsafe {
        let mut p = POINT::default();
        if GetCursorPos(&mut p).is_err() {
            return (0.0, 0.0, 0.5, 0.5);
        }
        let sw = GetSystemMetrics(SM_CXSCREEN).max(1) as f64;
        let sh = GetSystemMetrics(SM_CYSCREEN).max(1) as f64;
        let sx = (p.x as f64 / sw) * 2.0 - 1.0;
        let sy = (p.y as f64 / sh) * 2.0 - 1.0;
        let (mut wu, mut wv) = (0.5, 0.5);
        if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
            wu = (p.x as f64 - pos.x as f64) / (size.width as f64).max(1.0);
            wv = (p.y as f64 - pos.y as f64) / (size.height as f64).max(1.0);
        }
        (sx, sy, wu, wv)
    }
}

/// Koneksi X dibuka sekali (command ini dipolling ~60x/detik). `None` = tak ada
/// server X (mis. GDK_BACKEND dipaksa wayland oleh user) → tracking diam di tengah.
#[cfg(target_os = "linux")]
static X11: std::sync::OnceLock<Option<(x11rb::rust_connection::RustConnection, u32, f64, f64)>> =
    std::sync::OnceLock::new();

/// Versi Linux: XQueryPointer di root window. Di bawah XWayland nilainya membeku
/// saat kursor ada di atas window Wayland native (batas protokol, lihat Master State).
#[cfg(target_os = "linux")]
#[tauri::command]
fn cursor_norm(win: tauri::WebviewWindow) -> (f64, f64, f64, f64) {
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::ConnectionExt;

    let x = X11.get_or_init(|| {
        let (conn, screen_num) = x11rb::connect(None)
            .map_err(|e| log::warn!("[cursor] X11 tak tersedia: {e}"))
            .ok()?;
        let s = &conn.setup().roots[screen_num];
        let (root, w, h) = (s.root, s.width_in_pixels as f64, s.height_in_pixels as f64);
        Some((conn, root, w.max(1.0), h.max(1.0)))
    });
    let Some((conn, root, sw, sh)) = x else {
        return (0.0, 0.0, 0.5, 0.5);
    };
    let Some(p) = conn.query_pointer(*root).ok().and_then(|c| c.reply().ok()) else {
        return (0.0, 0.0, 0.5, 0.5);
    };
    let (px, py) = (p.root_x as f64, p.root_y as f64);
    let sx = (px / sw) * 2.0 - 1.0;
    let sy = (py / sh) * 2.0 - 1.0;
    let (mut wu, mut wv) = (0.5, 0.5);
    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
        wu = (px - pos.x as f64) / (size.width as f64).max(1.0);
        wv = (py - pos.y as f64) / (size.height as f64).max(1.0);
    }
    (sx, sy, wu, wv)
}

#[cfg(not(any(windows, target_os = "linux")))]
#[tauri::command]
fn cursor_norm() -> (f64, f64, f64, f64) {
    (0.0, 0.0, 0.5, 0.5)
}

fn set_click_through(app: &tauri::AppHandle, on: bool) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_ignore_cursor_events(on);
        CLICK_THROUGH.store(on, Ordering::Relaxed);
    }
}

/// Ubah ukuran window overlay (avatar ikut menyesuaikan lewat layout()).
/// Anchor ke titik tengah supaya posisi hasil drag user tetap terhormati.
/// Rasio dijaga 3:4 sesuai kanvas avatar (1080×1440).
#[tauri::command]
fn resize_overlay(app: tauri::AppHandle, width: f64) {
    if let Some(win) = app.get_webview_window("main") {
        let w = width.clamp(240.0, 1200.0);
        let h = (w * 4.0 / 3.0).round();
        let scale = win.scale_factor().unwrap_or(1.0);
        let new_pw = (w * scale) as i32;
        let new_ph = (h * scale) as i32;
        if let (Ok(pos), Ok(oldsz)) = (win.outer_position(), win.outer_size()) {
            let cx = pos.x + oldsz.width as i32 / 2;
            let cy = pos.y + oldsz.height as i32 / 2;
            let _ = win.set_size(tauri::LogicalSize::new(w, h));
            let _ = win.set_position(tauri::PhysicalPosition::new(cx - new_pw / 2, cy - new_ph / 2));
        } else {
            let _ = win.set_size(tauri::LogicalSize::new(w, h));
        }
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Overlay frameless + always-on-top (tauri.conf.json). Tembus-klik DEFAULT OFF,
    // dikontrol dari TRAY (selalu bisa balik). Tombol darurat: tray Keluar, taskbar, Alt+F4.
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![cursor_norm, resize_overlay, quit_app])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- Tray: kontrol tembus-klik + keluar (aman dari terkunci) ---
            let toggle =
                MenuItem::with_id(app, "toggle_ct", "Tembus klik: OFF", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar Hitomi 💔", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &quit])?;
            let toggle_handle = toggle.clone();

            TrayIconBuilder::with_id("hitomi-tray")
                .tooltip("Hitomi Live — klik kanan untuk menu")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "toggle_ct" => {
                        let now = !CLICK_THROUGH.load(Ordering::Relaxed);
                        set_click_through(app, now);
                        let _ = toggle_handle
                            .set_text(if now { "Tembus klik: ON" } else { "Tembus klik: OFF" });
                    }
                    _ => {}
                })
                .build(app)?;

            // --- Posisi awal: pojok kanan-bawah (tidak menutupi layar) ---
            if let Some(win) = app.get_webview_window("main") {
                if let (Ok(Some(mon)), Ok(sz)) = (win.primary_monitor(), win.outer_size()) {
                    let m = mon.size();
                    let margin: i32 = 24;
                    let taskbar: i32 = 60;
                    let x = (m.width as i32 - sz.width as i32 - margin).max(0);
                    let y = (m.height as i32 - sz.height as i32 - margin - taskbar).max(0);
                    let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
                }
            }

            // Pasang hook Claude Code sendiri (idempoten, non-destruktif) supaya
            // "jalankan exe" benar-benar cukup. Hasilnya dikirim ke webview biar
            // Hitomi bisa memberi tahu sendiri kalau ada yang kurang (mis. Node).
            let report = hook_setup::install();
            log::info!("[setup] {}", report.message);
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                // Tunggu sebentar: webview harus siap dulu sebelum dikirimi event.
                std::thread::sleep(std::time::Duration::from_millis(2500));
                let _ = handle.emit("hitomi://setup", report);
            });

            // Bridge in-process: mulai HTTP listener → event hook langsung masuk overlay.
            start_bridge(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
