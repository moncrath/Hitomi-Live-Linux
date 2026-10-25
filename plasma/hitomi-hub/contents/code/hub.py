#!/usr/bin/env python3
"""Data untuk tab Working dan CI. Hanya membaca; data sesi tak pernah dijalankan sebagai perintah."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

CLAUDE = Path.home() / ".claude"
SESSIONS = CLAUDE / "sessions"
# shortcut: transkrip tak menyimpan ukuran jendela konteks, jadi dianggap 1 juta token
# (sesi dengan model [1m]). Jalur upgrade: baca ukuran jendela dari model bila Claude Code menyimpannya.
CONTEXT_WINDOW = 1_000_000


def sessions():
    out = []
    # Hanya *.json: folder yang sama berisi file *.key yang tak boleh disentuh.
    for f in sorted(SESSIONS.glob("*.json")):
        try:
            d = json.loads(f.read_text())
            pid = int(d["pid"])
            cwd = str(d["cwd"])
            sid = str(d.get("sessionId", ""))
        except (OSError, ValueError, KeyError, TypeError):
            continue
        # shortcut: cek pid saja, belum procStart; pid yang dipakai ulang bisa lolos.
        if os.path.isdir(f"/proc/{pid}") and os.path.isdir(cwd):
            out.append({"pid": pid, "cwd": cwd, "sid": sid, "name": os.path.basename(cwd) or cwd})
    return out


def last_usage(path):
    """Token konteks dari pesan asisten terakhir di transkrip (input + cache baca + cache tulis)."""
    try:
        size = path.stat().st_size
    except OSError:
        return None
    # Ekor 512 KB dulu; kalau pesan terakhir tak ada di situ, coba 8 MB.
    for tail in (512 * 1024, 8 * 1024 * 1024):
        try:
            with open(path, "rb") as fh:
                fh.seek(max(0, size - tail))
                chunk = fh.read().decode("utf-8", errors="replace")
        except OSError:
            return None
        found = None
        for line in chunk.splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            m = d.get("message") if isinstance(d, dict) else None
            if (isinstance(m, dict) and m.get("role") == "assistant"
                    and isinstance(m.get("usage"), dict) and not d.get("isSidechain")):
                u = m["usage"]
                found = sum(int(u.get(k) or 0) for k in
                            ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
        if found is not None:
            return found
        if tail >= size:
            break
    return None


def context():
    out = []
    for s in sessions():
        # Nama folder proyek: setiap karakter selain huruf/angka menjadi "-".
        slug = re.sub(r"[^A-Za-z0-9]", "-", s["cwd"])
        used = last_usage(CLAUDE / "projects" / slug / f"{s['sid']}.jsonl") if s["sid"] else None
        out.append({"name": s["name"], "used": used, "window": CONTEXT_WINDOW})
    return out


def ci():
    seen, out = set(), []
    for s in sessions():
        if s["cwd"] in seen:
            continue
        seen.add(s["cwd"])
        state = "none"
        try:
            r = subprocess.run(
                ["gh", "run", "list", "--limit", "1", "--json", "status,conclusion"],
                cwd=s["cwd"], capture_output=True, text=True, timeout=8,
                env={**os.environ, "GH_PROMPT_DISABLED": "1"},
            )
            if r.returncode != 0:
                state = "error"
            else:
                runs = json.loads(r.stdout or "[]")
                if runs:
                    run = runs[0]
                    if run.get("status") != "completed":
                        state = "run"
                    else:
                        state = "ok" if run.get("conclusion") == "success" else "fail"
        except (OSError, ValueError, subprocess.TimeoutExpired):
            state = "error"
        out.append({"name": s["name"], "state": state})
    return out


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "context":
        print(json.dumps(context()))
    elif cmd == "ci":
        print(json.dumps(ci()))
    else:
        sys.exit(2)
