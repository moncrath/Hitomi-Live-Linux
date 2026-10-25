"""
Verifikasi registrasi + preview komposit dari aset asli Hitomi.
Baca file bernomor di ../layers, cek dimensi seragam, lalu render:
  preview/base.png            -> karakter idle (base tracking eyes)
  preview/expressions.png     -> contact sheet beberapa state
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYERS = os.path.join(ROOT, "layers")
OUT = os.path.join(HERE, "preview")
os.makedirs(OUT, exist_ok=True)

CW, CH = 1080, 1440


def L(name):
    """load layer by exact filename (without .png)"""
    p = os.path.join(LAYERS, name + ".png")
    return Image.open(p).convert("RGBA")


def font(sz, bold=True):
    for n in (["arialbd.ttf"] if bold else ["arial.ttf"]):
        try:
            return ImageFont.truetype(n, sz)
        except Exception:
            pass
    return ImageFont.load_default()


# base stack (bottom -> top), memakai eyes tracking + mulut tertutup
BASE = [
    "1_back-accessories", "2_back-hair", "3_lefthair_back", "4_righthair_back",
    "5_lefthand", "6_righthand", "7_body", "8_headbase",
    "9b_mouth_closed",
    "10_eyes_background", "10_eyes_pupil_left", "10_eyes_pupil_right", "10_eyes_frame",
    "11_side_small_hair", "12_bangs", "13_left_eyebrow", "14_right_eyebrow",
    "15_head_accessories",
]

# semua yang di bawah mata (tak berubah antar ekspresi)
UNDER = ["1_back-accessories", "2_back-hair", "3_lefthair_back", "4_righthair_back",
         "5_lefthand", "6_righthand", "7_body", "8_headbase"]
OVER = ["11_side_small_hair", "12_bangs", "13_left_eyebrow", "14_right_eyebrow",
        "15_head_accessories"]
EYE_BASE = ["10_eyes_background", "10_eyes_pupil_left", "10_eyes_pupil_right", "10_eyes_frame"]


def compose(stack):
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    for n in stack:
        canvas.alpha_composite(L(n))
    return canvas


def state(eye_layers, mouth):
    return UNDER + [mouth] + eye_layers + OVER


def check_dims():
    print("== DIMENSI ==")
    bad = []
    for f in sorted(os.listdir(LAYERS)):
        if not f.endswith(".png"):
            continue
        im = Image.open(os.path.join(LAYERS, f))
        tag = "" if im.size == (CW, CH) else "  <-- BEDA!"
        if im.size != (CW, CH) and os.path.getsize(os.path.join(LAYERS, f)) > 8000:
            bad.append((f, im.size))
        # hanya cetak yang beda biar ringkas
        if tag:
            print(f"{f:34s} {im.size}{tag}")
    print("Semua lain = 1080x1440." if not bad else f"{len(bad)} file beda ukuran.")
    return bad


STATES = [
    ("idle",    EYE_BASE, "9b_mouth_closed"),
    ("blink",   ["10a_eyes_closed"], "9b_mouth_closed"),
    ("sukses",  ["10b_eyes_closed_happy"], "9c_mouth_grin"),
    ("error",   ["10d_eyes_shocked"], "9g_mouth_shocked"),
    ("marah",   ["10e_eyes_angry"], "9i_mouth_angry"),
    ("minder",  ["10g_eyes_sad"], "9h_mouth_pout"),
    ("dizzy",   ["10c_eyes_dizzy"], "9f_mouth_sad"),
    ("love",    ["10f_eyes_love-or-yandere"], "9d_mouth_happy2"),
]


def contact_sheet():
    cols = 4
    rows = (len(STATES) + cols - 1) // cols
    tw, th = 300, 400  # thumb
    pad, labelh = 16, 30
    W = cols * tw + (cols + 1) * pad
    H = rows * (th + labelh) + (rows + 1) * pad
    sheet = Image.new("RGBA", (W, H), (245, 245, 248, 255))
    d = ImageDraw.Draw(sheet)
    f = font(20)
    for i, (name, eyes, mouth) in enumerate(STATES):
        img = compose(state(eyes, mouth)).resize((tw, th), Image.LANCZOS)
        c = i % cols
        r = i // cols
        x = pad + c * (tw + pad)
        y = pad + r * (th + labelh + pad)
        # checker bg biar transparan kelihatan
        chk = Image.new("RGBA", (tw, th), (255, 255, 255, 255))
        cd = ImageDraw.Draw(chk)
        for yy in range(0, th, 20):
            for xx in range(0, tw, 20):
                if (xx // 20 + yy // 20) % 2 == 0:
                    cd.rectangle([xx, yy, xx + 20, yy + 20], fill=(225, 225, 230, 255))
        sheet.alpha_composite(chk, (x, y))
        sheet.alpha_composite(img, (x, y))
        d.text((x + 4, y + th + 4), name, font=f, fill=(30, 20, 30))
    sheet.save(os.path.join(OUT, "expressions.png"))


def main():
    check_dims()
    compose(BASE).save(os.path.join(OUT, "base.png"))
    contact_sheet()
    print("OK -> preview/base.png, preview/expressions.png")


if __name__ == "__main__":
    main()
