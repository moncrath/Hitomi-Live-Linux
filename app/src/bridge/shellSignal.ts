import { onShell } from '../shell';

/**
 * Terima sinyal dari bridge in-process shell (Rust di Tauri, Node di Electron).
 * Menggantikan koneksi WebSocket saat berjalan di dalam overlay — tak perlu
 * proses bridge Node terpisah lagi.
 */
export async function listenShellSignal(
  cb: (s: { kind: string; name: string }) => void,
): Promise<void> {
  await onShell('signal', cb);
}

/** Laporan pemasangan hook otomatis (`hook_setup.rs` / `electron/hookSetup.mjs`). */
export interface SetupReport {
  ready: boolean;
  changed: boolean;
  node: boolean;
  message: string;
}

/** Dengarkan hasil pemasangan hook saat start. */
export async function listenShellSetup(cb: (r: SetupReport) => void): Promise<void> {
  await onShell('setup', cb);
}
