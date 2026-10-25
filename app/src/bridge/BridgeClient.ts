export interface BridgeSignal {
  kind: 'event' | 'state';
  name: string;
}

/**
 * Klien WebSocket ke bridge lokal. Auto-reconnect (backoff) supaya overlay
 * tetap jalan walau bridge belum/putus. Cuma menerima sinyal { kind, name }.
 */
export class BridgeClient {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly onSignal: (s: BridgeSignal) => void,
  ) {}

  connect(): void {
    this.closed = false;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      this.retry = 0;
      console.log('[bridge] connected');
    });

    this.ws.addEventListener('message', (e: MessageEvent) => {
      try {
        const raw = typeof e.data === 'string' ? e.data : '';
        const s = JSON.parse(raw) as Partial<BridgeSignal>;
        if ((s.kind === 'event' || s.kind === 'state') && typeof s.name === 'string') {
          this.onSignal({ kind: s.kind, name: s.name });
        }
      } catch {
        /* abaikan pesan rusak */
      }
    });

    this.ws.addEventListener('close', () => this.scheduleReconnect());
    this.ws.addEventListener('error', () => this.ws?.close());
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.retry = Math.min(this.retry + 1, 6);
    setTimeout(() => this.connect(), 400 * this.retry); // 0.4s .. 2.4s
  }
}
