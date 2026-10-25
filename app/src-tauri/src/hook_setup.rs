//! Pemasang hook otomatis.
//!
//! Tanpa hook, exe ini cuma avatar cantik yang diam: hook dipanggil oleh **Claude
//! Code**, bukan oleh overlay. Dulu pemasangannya manual (salin script + sunting
//! `~/.claude/settings.json`) dan itu satu-satunya alasan orang gagal memakai
//! Hitomi. Modul ini mengerjakannya sendiri saat exe dijalankan.
//!
//! Aturan yang dipegang, karena kita menyunting file konfigurasi milik user:
//!  - **Non-destruktif**: hanya menambah entri hook milik kita; blok lain
//!    (`permissions`, hook orang lain) tak pernah disentuh.
//!  - **Backup dulu** ke `settings.json.bak` sebelum perubahan pertama.
//!  - **Idempoten**: dijalankan tiap start, tapi hanya menulis bila memang beda.
//!  - **Menyembuhkan diri**: entri kita yang menunjuk path lama diperbarui.
//!  - **Gagal dengan tenang**: kalau JSON-nya rusak/tak terbaca, jangan timpa apa
//!    pun — lapor saja, biarkan user yang putuskan.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// Script hook ikut ke-bake dalam exe supaya tak perlu file pendamping.
const NOTIFY_MJS: &str = include_str!("../../../hooks/notify.mjs");

/// Event Claude Code yang dipetakan ke reaksi avatar (lihat manifest `events`).
const EVENTS: [&str; 6] = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "Notification",
    "Stop",
];

/// Hasil pemasangan, dikirim ke frontend supaya Hitomi bisa memberi tahu sendiri.
#[derive(serde::Serialize, Clone)]
pub struct SetupReport {
    /// Hook siap dipakai (terpasang & terdaftar).
    pub ready: bool,
    /// Ada yang baru saja ditulis/diperbaiki pada start ini.
    pub changed: bool,
    /// Node.js terdeteksi — tanpa ini hook tak akan pernah jalan.
    pub node: bool,
    pub message: String,
}

fn claude_dir() -> Option<PathBuf> {
    // Ikut Claude Code: CLAUDE_CONFIG_DIR bila di-set, kalau tidak ~/.claude
    if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        if !dir.trim().is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(|h| Path::new(&h).join(".claude"))
}

fn node_available() -> bool {
    std::process::Command::new("node")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Perintah hook untuk satu event. Path di-quote (bisa mengandung spasi) dan
/// dinormalkan ke garis miring biasa — Node menerimanya di Windows, dan bentuk
/// inilah yang ditulis manusia, jadi kita tak menulis ulang settings user
/// hanya gara-gara beda gaya pemisah path.
fn command_for(script: &Path, event: &str) -> String {
    let path = script.display().to_string().replace('\\', "/");
    format!("node \"{path}\" {event}")
}

/// Apakah sebuah entri hook adalah milik kita (dilihat dari nama scriptnya)?
fn is_ours(cmd: &str) -> bool {
    cmd.contains("hitomi-notify.mjs")
}

/// Sisipkan/perbaiki entri hook kita untuk satu event, tanpa mengusik entri lain.
/// Mengembalikan true bila ada perubahan.
fn ensure_event(hooks: &mut Value, event: &str, script: &Path) -> bool {
    let want = command_for(script, event);
    // `matcher` "*" dibutuhkan event bertipe tool (PreToolUse/PostToolUse); untuk
    // event lain tak berpengaruh, jadi dipasang seragam biar sederhana.
    let entry = json!({
        "matcher": "*",
        "hooks": [ { "type": "command", "command": want } ]
    });

    let list = hooks
        .as_object_mut()
        .unwrap()
        .entry(event)
        .or_insert_with(|| Value::Array(vec![]));
    let Some(arr) = list.as_array_mut() else {
        return false; // bentuk tak terduga -> jangan rusak apa pun
    };

    // Cari entri milik kita; kalau ada tapi perintahnya beda (mis. exe dipindah),
    // perbarui. Kalau belum ada, tambahkan di belakang.
    for group in arr.iter_mut() {
        let Some(inner) = group.get_mut("hooks").and_then(|h| h.as_array_mut()) else {
            continue;
        };
        for h in inner.iter_mut() {
            let cmd = h.get("command").and_then(|c| c.as_str()).unwrap_or("");
            if is_ours(cmd) {
                if cmd == want {
                    return false;
                }
                h["command"] = Value::String(want);
                return true;
            }
        }
    }
    arr.push(entry);
    true
}

/// Pasang script + daftarkan hook. Dipanggil sekali saat start.
pub fn install() -> SetupReport {
    let node = node_available();

    let Some(dir) = claude_dir() else {
        return SetupReport {
            ready: false,
            changed: false,
            node,
            message: "Folder ~/.claude tak ketemu — hook belum bisa dipasang.".into(),
        };
    };

    // 1) Tulis script hook (hanya bila isinya beda -> hemat tulis & aman diulang).
    let hooks_dir = dir.join("hooks");
    let script = hooks_dir.join("hitomi-notify.mjs");
    let mut changed = false;
    if std::fs::create_dir_all(&hooks_dir).is_err() {
        return SetupReport {
            ready: false,
            changed: false,
            node,
            message: format!("Gagal bikin folder {}", hooks_dir.display()),
        };
    }
    let current = std::fs::read_to_string(&script).unwrap_or_default();
    if current != NOTIFY_MJS {
        if std::fs::write(&script, NOTIFY_MJS).is_err() {
            return SetupReport {
                ready: false,
                changed: false,
                node,
                message: format!("Gagal menulis {}", script.display()),
            };
        }
        changed = true;
    }

    // 2) Daftarkan ke settings.json — hati-hati, ini file milik user.
    let settings_path = dir.join("settings.json");
    let raw = std::fs::read_to_string(&settings_path).unwrap_or_else(|_| "{}".into());
    let mut settings: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            // JSON rusak: JANGAN timpa. Lebih baik Hitomi diam daripada
            // menghancurkan konfigurasi Claude Code milik user.
            return SetupReport {
                ready: false,
                changed,
                node,
                message: format!("settings.json tak terbaca ({e}) — hook tak diubah."),
            };
        }
    };
    if !settings.is_object() {
        settings = json!({});
    }

    let obj = settings.as_object_mut().unwrap();
    if !obj.get("hooks").map(|h| h.is_object()).unwrap_or(false) {
        obj.insert("hooks".into(), json!({}));
    }
    let mut hooks = obj.get("hooks").cloned().unwrap_or_else(|| json!({}));

    let mut touched = false;
    for ev in EVENTS {
        if ensure_event(&mut hooks, ev, &script) {
            touched = true;
        }
    }

    if touched {
        // Backup sekali sebelum perubahan pertama (jangan menimpa backup lama).
        let backup = dir.join("settings.json.bak");
        if settings_path.exists() && !backup.exists() {
            let _ = std::fs::copy(&settings_path, &backup);
        }
        obj.insert("hooks".into(), hooks);
        let pretty = serde_json::to_string_pretty(&settings).unwrap_or(raw);
        if std::fs::write(&settings_path, pretty).is_err() {
            return SetupReport {
                ready: false,
                changed,
                node,
                message: format!("Gagal menulis {}", settings_path.display()),
            };
        }
        changed = true;
    }

    let message = if !node {
        "Hook terpasang, tapi Node.js tak terdeteksi — hook butuh Node untuk jalan.".into()
    } else if changed {
        "Hook Claude Code baru saja dipasang/diperbarui. Siap!".to_string()
    } else {
        "Hook sudah terpasang.".to_string()
    };

    SetupReport {
        ready: node,
        changed,
        node,
        message,
    }
}
