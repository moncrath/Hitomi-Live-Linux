"""
Generator kanvas template + guide untuk avatar PNGtuber "Hitomi".
Reproducible: jalankan ulang kapan pun spec berubah.

Output:
  _template/canvas_blank.png      -> kanvas transparan murni (master)
  _template/layout_guide.png      -> guide posisi layer + pivot + safe margin
  _template/expression_guide.png  -> slot ekspresi (alis/mulut) + state map
  layers/*.png                    -> blank transparan per layer (siap digambar)
  avatar-spec.json                -> spesifikasi terkunci (dibaca engine nanti)

Semua layer memakai kanvas seragam CANVAS_W x CANVAS_H. Origin (0,0) = kiri-atas.
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

CANVAS_W, CANVAS_H = 1080, 1440
SAFE = 40  # margin aman dari tepi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                 # assets/avatar/hitomi
LAYERS_DIR = os.path.join(ROOT, "layers")
os.makedirs(LAYERS_DIR, exist_ok=True)


# ---------- font helper ----------
def font(size, bold=False):
    for name in (["arialbd.ttf", "arial.ttf"] if bold else ["arial.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


def box(cx, cy, w, h):
    return (cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)


# ---------- definisi layout (center-based) ----------
# (key, label, box, pivot, rgb, z, catatan)
LAYERS = [
    ("hair_back",   "Rambut belakang", box(540, 620, 620, 780), (540, 260), (150, 80, 200), 10, "sway + parallax"),
    ("body",        "Badan / torso",   box(540, 1150, 720, 580), (540, 1380), (80, 120, 200), 20, "napas (scale halus)"),
    ("head",        "Kepala / wajah",  box(540, 560, 400, 440), (540, 780), (230, 140, 60), 40, "tilt kepala"),
    ("eyes_open",   "Mata (buka/sklera)", None, None, (60, 170, 170), 50, "jadi mask pupil"),
    ("pupils",      "Pupil + iris",    None, None, (40, 40, 40), 60, "eye-tracking"),
    ("eyes_closed", "Mata (tutup)",    None, None, (100, 150, 150), 70, "blink"),
    ("brows",       "Alis",            None, None, (120, 90, 60), 80, "ekspresi (varian)"),
    ("mouth",       "Mulut",           box(540, 700, 130, 90), (540, 700), (200, 80, 120), 90, "ekspresi (varian)"),
    ("blush",       "Blush (opsional)", box(540, 650, 380, 90), (540, 650), (240, 150, 170), 95, "fade minder/error"),
    ("hair_front",  "Rambut depan",    box(540, 420, 580, 440), (540, 340), (180, 100, 220), 110, "sway ringan"),
]

# region mata & alis (kiri/kanan)
EYE_L = box(460, 600, 140, 95)
EYE_R = box(620, 600, 140, 95)
PUP_L = box(460, 600, 72, 72)
PUP_R = box(620, 600, 72, 72)
BROW_L = box(460, 540, 120, 36)
BROW_R = box(620, 540, 120, 36)

# varian ekspresi
BROW_VARIANTS = ["neutral", "raised", "worried", "angry"]
MOUTH_VARIANTS = ["neutral", "smile", "open", "flat", "frown", "wavy"]

STATE_MAP = [
    ("idle",    "neutral", "neutral/open", "-"),
    ("mikir",   "raised",  "flat",         "-"),
    ("ngoding", "neutral", "neutral",      "-"),
    ("sukses",  "raised",  "smile",        "-"),
    ("error",   "angry",   "frown",        "-"),
    ("marah",   "angry",   "frown",        "-"),
    ("minder",  "worried", "wavy",         "on"),
]


# ---------- 1. kanvas transparan murni ----------
def make_blank(path):
    Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0)).save(path)


# ---------- 2. layout guide ----------
def draw_dashed_rect(d, bbox, color, dash=14, gap=10, width=2):
    x0, y0, x1, y1 = bbox
    def hline(y):
        x = x0
        while x < x1:
            d.line([(x, y), (min(x + dash, x1), y)], fill=color, width=width)
            x += dash + gap
    def vline(x):
        y = y0
        while y < y1:
            d.line([(x, y), (x, min(y + dash, y1))], fill=color, width=width)
            y += dash + gap
    hline(y0); hline(y1); vline(x0); vline(x1)


def label(d, x, y, text, color, size=22, bold=True):
    f = font(size, bold)
    # halo putih biar kebaca di atas warna apa pun
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        d.text((x + dx, y + dy), text, font=f, fill=(255, 255, 255, 230))
    d.text((x, y), text, font=f, fill=color)


def pivot_marker(d, px, py, color=(220, 30, 60)):
    r = 10
    d.ellipse([px - r, py - r, px + r, py + r], outline=color, width=3)
    d.line([(px - 18, py), (px + 18, py)], fill=color, width=3)
    d.line([(px, py - 18), (px, py + 18)], fill=color, width=3)


def region(d, bbox, color, name, alpha=40):
    overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle(bbox, fill=color + (alpha,), outline=color + (255,), width=3)
    d._image.alpha_composite(overlay)
    label(d, bbox[0] + 8, bbox[1] + 6, name, color)


def make_layout_guide(path):
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (250, 250, 252, 255))
    d = ImageDraw.Draw(img, "RGBA")
    d._image = img  # simpan ref utk alpha_composite

    # grid halus tiap 60px
    for x in range(0, CANVAS_W, 60):
        d.line([(x, 0), (x, CANVAS_H)], fill=(230, 230, 235), width=1)
    for y in range(0, CANVAS_H, 60):
        d.line([(0, y), (CANVAS_W, y)], fill=(230, 230, 235), width=1)

    # sumbu tengah
    d.line([(CANVAS_W // 2, 0), (CANVAS_W // 2, CANVAS_H)], fill=(255, 120, 165, 180), width=2)

    # safe margin
    draw_dashed_rect(d, (SAFE, SAFE, CANVAS_W - SAFE, CANVAS_H - SAFE), (255, 100, 100), width=2)
    label(d, SAFE + 6, SAFE + 4, "SAFE MARGIN", (255, 80, 80), size=18)

    # regions
    for key, lbl, bb, piv, rgb, z, note in LAYERS:
        if bb is not None:
            region(d, bb, rgb, f"{lbl}")
        if piv is not None:
            pivot_marker(d, *piv)

    # mata / pupil / alis (kiri-kanan)
    for bb in (EYE_L, EYE_R):
        region(d, bb, (60, 170, 170), "eyes_open", alpha=35)
    for bb in (PUP_L, PUP_R):
        d.ellipse(bb, outline=(40, 40, 40, 255), width=2)
    for bb in (BROW_L, BROW_R):
        region(d, bb, (120, 90, 60), "brow", alpha=35)

    # header
    hdr = Image.new("RGBA", (CANVAS_W, 96), (30, 20, 30, 220))
    img.alpha_composite(hdr, (0, 0))
    label(d, 24, 20, "HITOMI — LAYOUT GUIDE  (1080x1440)", (255, 255, 255), size=30)
    label(d, 24, 58, "Titik merah = PIVOT (poros animasi). Jangan gambar di layer ini.",
          (255, 210, 220), size=18, bold=False)

    img.save(path)


# ---------- 3. expression guide ----------
def make_expression_guide(path):
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (250, 250, 252, 255))
    d = ImageDraw.Draw(img, "RGBA")

    label(d, 24, 24, "HITOMI — EXPRESSION SLOTS", (30, 20, 30), size=32)
    label(d, 24, 66, "Gambar tiap varian di file terpisah, ukuran & posisi = sama seperti layout guide.",
          (90, 80, 90), size=18, bold=False)

    # ALIS
    y = 130
    label(d, 24, y, "ALIS (brows_*)  — konten ~120x36 px per alis", (120, 90, 60), size=24)
    y += 46
    bw, bh, gap = 210, 72, 30  # preview ~1.75x
    for i, v in enumerate(BROW_VARIANTS):
        x = 30 + i * (bw + gap)
        d.rectangle([x, y, x + bw, y + bh], outline=(120, 90, 60), width=2, fill=(120, 90, 60, 20))
        label(d, x + 6, y + bh + 6, v, (120, 90, 60), size=18)

    # MULUT
    y += bh + 70
    label(d, 24, y, "MULUT (mouth_*)  — konten ~130x90 px", (200, 80, 120), size=24)
    y += 46
    mw, mh = 260, 180  # preview 2x
    perrow = 3
    for i, v in enumerate(MOUTH_VARIANTS):
        col = i % perrow
        row = i // perrow
        x = 30 + col * (mw + gap)
        yy = y + row * (mh + 50)
        d.rectangle([x, yy, x + mw, yy + mh], outline=(200, 80, 120), width=2, fill=(200, 80, 120, 20))
        label(d, x + 6, yy + mh + 6, v, (200, 80, 120), size=18)

    # STATE MAP
    y = y + 2 * (mh + 50) + 20
    label(d, 24, y, "STATE MAP  (event -> ekspresi)", (30, 20, 30), size=24)
    y += 44
    f = font(20)
    fb = font(20, bold=True)
    cols = [("STATE", 30), ("alis", 260), ("mulut", 470), ("blush", 760)]
    for name, cx in cols:
        d.text((cx, y), name, font=fb, fill=(60, 40, 60))
    y += 34
    for st, br, mo, bl in STATE_MAP:
        d.text((30, y), st, font=fb, fill=(200, 70, 120))
        d.text((260, y), br, font=f, fill=(60, 60, 60))
        d.text((470, y), mo, font=f, fill=(60, 60, 60))
        d.text((760, y), bl, font=f, fill=(60, 60, 60))
        y += 32

    img.save(path)


# ---------- 4. blank per-layer ----------
def make_layer_blanks():
    names = ["hair_back", "body", "head", "eyes_open", "eyes_closed", "pupils",
             "mouth_neutral", "hair_front", "blush", "arm_back", "arm_front"]
    names += [f"brows_{v}" for v in BROW_VARIANTS]
    names += [f"mouth_{v}" for v in MOUTH_VARIANTS]
    for n in sorted(set(names)):
        make_blank(os.path.join(LAYERS_DIR, f"{n}.png"))
    return sorted(set(names))


# ---------- 5. spec JSON ----------
def make_spec(path, layer_names):
    spec = {
        "name": "hitomi",
        "canvas": {"width": CANVAS_W, "height": CANVAS_H, "safe_margin": SAFE},
        "format": "PNG-32 RGBA, sRGB, transparan, semua layer di kanvas seragam",
        "groups": {
            "head_group": {
                "note": "di-tilt bersama saat head-tracking, poros di leher",
                "pivot": [540, 780],
                "members": ["head", "eyes_open", "pupils", "eyes_closed",
                            "brows", "mouth", "blush", "hair_front"]
            }
        },
        "layers": [
            {"key": k, "label": lbl, "z": z, "pivot": piv,
             "bbox": bb, "note": note}
            for (k, lbl, bb, piv, rgb, z, note) in LAYERS
        ],
        "eye_regions": {"left": EYE_L, "right": EYE_R,
                        "pupil_left": PUP_L, "pupil_right": PUP_R},
        "brow_regions": {"left": BROW_L, "right": BROW_R},
        "expressions": {
            "brows": BROW_VARIANTS,
            "mouth": MOUTH_VARIANTS,
            "state_map": {st: {"brows": br, "mouth": mo, "blush": bl}
                          for (st, br, mo, bl) in STATE_MAP}
        },
        "bubble": {
            "shape": "rounded_rect", "corner_radius": 24,
            "padding": [20, 24], "min_w": 160, "max_w": 420,
            "tail": [32, 28], "fill": "#FFF6FA", "border": "#FF6FA5",
            "border_w": 3, "text": "#3A2B33", "font": "Nunito/Quicksand 16-18"
        },
        "layer_files": layer_names
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)


def main():
    make_blank(os.path.join(HERE, "canvas_blank.png"))
    make_layout_guide(os.path.join(HERE, "layout_guide.png"))
    make_expression_guide(os.path.join(HERE, "expression_guide.png"))
    names = make_layer_blanks()
    make_spec(os.path.join(ROOT, "avatar-spec.json"), names)
    print("OK. Layers:", len(names), "->", ", ".join(names))


if __name__ == "__main__":
    main()
