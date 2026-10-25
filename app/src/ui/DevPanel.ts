import type { Manifest } from '../types';
import type { AvatarRenderer } from '../renderer/AvatarRenderer';

/** Panel dev overlay: tombol untuk tiap state & event (Fase 1a debugging). */
export class DevPanel {
  constructor(renderer: AvatarRenderer, m: Manifest, onBubble?: () => void) {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'top:10px',
      'left:10px',
      'z-index:10',
      'font:12px system-ui,sans-serif',
      'color:#ffd7ea',
      'background:rgba(28,20,30,.82)',
      'border:1px solid #ff6fa5',
      'border-radius:12px',
      'padding:10px 12px',
      'max-width:280px',
      'user-select:none',
    ].join(';');

    root.appendChild(this.section('States'));
    const states = document.createElement('div');
    states.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    for (const name of Object.keys(m.states)) {
      states.appendChild(this.btn(name, () => renderer.setState(name)));
    }
    root.appendChild(states);

    root.appendChild(this.section('Events (hook)'));
    const events = document.createElement('div');
    events.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    for (const name of Object.keys(m.events)) {
      if (name === 'note') continue;
      events.appendChild(this.btn(name, () => renderer.event(name), true));
    }
    root.appendChild(events);

    if (onBubble) {
      root.appendChild(this.section('Bubble'));
      root.appendChild(this.btn('bubble teks', onBubble, true));
    }

    const hint = document.createElement('div');
    hint.textContent = 'Gerakkan kursor: eye-track + head-tilt + hair-sway.';
    hint.style.cssText = 'margin-top:8px;opacity:.7;line-height:1.4';
    root.appendChild(hint);

    document.body.appendChild(root);
  }

  private section(title: string): HTMLElement {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-weight:700;margin:8px 0 4px;color:#ff9ec9';
    return h;
  }

  private btn(label: string, onClick: () => void, accent = false): HTMLElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'cursor:pointer',
      'font:11px system-ui',
      'padding:3px 7px',
      'border-radius:7px',
      'border:1px solid ' + (accent ? '#7a86ff' : '#ff6fa5'),
      'background:' + (accent ? 'rgba(122,134,255,.15)' : 'rgba(255,111,165,.15)'),
      'color:#fff',
    ].join(';');
    b.addEventListener('click', onClick);
    return b;
  }
}
