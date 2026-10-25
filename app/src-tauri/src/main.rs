// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Di Wayland native, GTK tak bisa memindah window, always-on-top tak dijamin, dan
  // posisi kursor global tak bisa dibaca sama sekali. Lewat XWayland semuanya jalan.
  // Harus di-set sebelum GTK init; pilihan user (GDK_BACKEND sudah ada) dihormati.
  #[cfg(target_os = "linux")]
  if std::env::var_os("WAYLAND_DISPLAY").is_some() && std::env::var_os("GDK_BACKEND").is_none() {
    std::env::set_var("GDK_BACKEND", "x11");
  }
  app_lib::run();
}
