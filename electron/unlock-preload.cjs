// Preload window pembuka kunci (lihat `createUnlockWindow` di main.mjs). Halamannya
// kosong; satu-satunya tugas: lapor ke main saat diklik.

const { ipcRenderer } = require('electron');

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) ipcRenderer.send('unlock_click');
});
