/**
 * Bubble teks Hitomi (Fase 2). Menampilkan kalimat terakhir Hitomi dari transkrip
 * (dikirim hook `Stop` → `/bubble` → event Tauri `hitomi://bubble`). Auto-hilang,
 * posisi ikut preferensi sisi (`hitomi.bubbleSide`, sama dgn menu). Font Itim.
 */
import { isShell, onShell } from '../shell';

const PURPLE = '#3e2271';
const PINK = '#fab3df';
const FONT = "'Itim', system-ui, sans-serif";
const EASE_POP = 'cubic-bezier(.2,1.5,.4,1)'; // sedikit overshoot saat muncul

interface BubbleHooks {
  onShow?: () => void; // bubble muncul (mulai animasi "ngomong")
  onHide?: () => void; // bubble hilang (berhenti "ngomong")
}

export interface BubbleController {
  show: (text: string) => void; // dipakai listener Tauri & tombol dev
  hide: () => void;
}

export async function mountHitomiBubble(hooks: BubbleHooks = {}): Promise<BubbleController> {
  const bubble = document.createElement('div');
  Object.assign(bubble.style, {
    position: 'fixed',
    top: '56px', // di bawah tombol menu (yang di top:14)
    maxWidth: '260px',
    padding: '11px 14px',
    background: PURPLE,
    border: `2px solid ${PINK}`,
    borderRadius: '16px',
    color: '#ffffff',
    fontFamily: FONT,
    fontSize: '15px',
    lineHeight: '1.35',
    boxShadow: '0 8px 24px rgba(0,0,0,.45)',
    pointerEvents: 'none',
    zIndex: '11',
    opacity: '0',
    transform: 'translateY(-6px) scale(.94)',
    // Masuk: pop kecil (overshoot). Keluar: ease biasa — di-set ulang di hide().
    transition: `opacity .2s ease, transform .26s ${EASE_POP}`,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  });

  // Ekor bubble: kotak diputar 45° dgn 2 sisi ber-border → segitiga ber-outline
  // yang menunjuk ke bawah (ke arah kepala avatar). Border sisi dalam ketutup badan bubble.
  const tail = document.createElement('div');
  Object.assign(tail.style, {
    position: 'absolute',
    bottom: '-8px',
    width: '14px',
    height: '14px',
    background: PURPLE,
    borderRight: `2px solid ${PINK}`,
    borderBottom: `2px solid ${PINK}`,
    borderBottomRightRadius: '3px',
    transform: 'rotate(45deg)',
  });
  bubble.appendChild(tail);
  document.body.appendChild(bubble);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;

  const hide = (): void => {
    if (!visible) return;
    visible = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    bubble.style.transition = 'opacity .18s ease, transform .18s ease';
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(-6px) scale(.94)';
    hooks.onHide?.();
  };

  const show = (text: string): void => {
    const side = (localStorage.getItem('hitomi.bubbleSide') as 'left' | 'right') || 'right';
    bubble.style.left = side === 'left' ? '14px' : '';
    bubble.style.right = side === 'left' ? '' : '14px';
    bubble.style.textAlign = side === 'left' ? 'left' : 'right';
    // Ekor & titik tumpu skala di sisi yang sama → pop-nya terasa "keluar dari" avatar.
    tail.style.left = side === 'left' ? '22px' : '';
    tail.style.right = side === 'left' ? '' : '22px';
    bubble.style.transformOrigin = side === 'left' ? '22px 100%' : 'calc(100% - 22px) 100%';

    // textContent (bukan innerHTML) → teks transkrip aman; ekor di-append ulang.
    bubble.textContent = text;
    bubble.appendChild(tail);
    bubble.style.transition = `opacity .2s ease, transform .26s ${EASE_POP}`;
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateY(0) scale(1)';
    visible = true;
    hooks.onShow?.();

    if (hideTimer) clearTimeout(hideTimer);
    const dur = Math.min(16000, 4000 + text.length * 95); // cukup lama buat dibaca
    hideTimer = setTimeout(hide, dur);
  };

  // Sumber teks cuma ada di overlay (shell); di browser (dev) bubble dipicu DevPanel.
  if (isShell()) {
    await onShell<{ text: string }>('bubble', (p) => show(p.text));
  }

  return { show, hide };
}
