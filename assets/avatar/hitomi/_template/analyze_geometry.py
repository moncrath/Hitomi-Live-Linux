"""Hitung bounding-box piksel non-transparan tiap layer -> untuk pivot akurat."""
import os
from PIL import Image

LAYERS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "layers")

keys = ["2_back-hair", "3_lefthair_back", "4_righthair_back", "7_body",
        "8_headbase", "12_bangs", "11_side_small_hair",
        "10_eyes_frame", "10_eyes_pupil_left", "10_eyes_pupil_right",
        "13_left_eyebrow", "14_right_eyebrow", "9b_mouth_closed", "15_head_accessories"]

print(f"{'layer':26s} {'x0':>5}{'y0':>5}{'x1':>5}{'y1':>5}  {'cx':>5}{'cy':>5}")
for k in keys:
    p = os.path.join(LAYERS, k + ".png")
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGBA")
    bb = im.getbbox()
    if not bb:
        print(f"{k:26s}  (kosong)")
        continue
    x0, y0, x1, y1 = bb
    print(f"{k:26s} {x0:5d}{y0:5d}{x1:5d}{y1:5d}  {(x0+x1)//2:5d}{(y0+y1)//2:5d}")
