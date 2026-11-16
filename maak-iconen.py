#!/usr/bin/env python3
"""Genereert de app-iconen voor Shut the Box (192, 512 en 512-maskable)."""
from PIL import Image, ImageDraw
import math, os

ACHTERGROND = (23, 16, 8)       # #171008
HOUT_1 = (46, 34, 20)           # paneel
ACCENT = (232, 163, 61)         # #e8a33d
DOBBEL = (250, 246, 238)
PIP = (34, 23, 8)

PIP_POS = {
    1: [(0.5, 0.5)],
    2: [(0.28, 0.28), (0.72, 0.72)],
    3: [(0.26, 0.26), (0.5, 0.5), (0.74, 0.74)],
    4: [(0.3, 0.3), (0.7, 0.3), (0.3, 0.7), (0.7, 0.7)],
    5: [(0.28, 0.28), (0.72, 0.28), (0.5, 0.5), (0.28, 0.72), (0.72, 0.72)],
    6: [(0.3, 0.26), (0.7, 0.26), (0.3, 0.5), (0.7, 0.5), (0.3, 0.74), (0.7, 0.74)],
}


def afgerond(draw, box, straal, **kw):
    draw.rounded_rectangle(box, radius=straal, **kw)


def teken_dobbelsteen(img, cx, cy, maat, hoek_graden, waarde):
    """Tekent een gedraaide dobbelsteen op een losse laag en plakt die."""
    laag = Image.new("RGBA", (maat * 2, maat * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(laag)
    x0, y0 = maat // 2, maat // 2
    x1, y1 = x0 + maat, y0 + maat
    # subtiele schaduw/bodem
    afgerond(d, [x0, y0 + maat // 25, x1, y1 + maat // 25], maat // 6, fill=(207, 198, 179, 255))
    afgerond(d, [x0, y0, x1, y1], maat // 6, fill=DOBBEL + (255,))
    pr = maat * 0.09
    for (fx, fy) in PIP_POS[waarde]:
        px = x0 + fx * maat
        py = y0 + fy * maat
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=PIP + (255,))
    laag = laag.rotate(hoek_graden, resample=Image.BICUBIC, center=(maat, maat))
    img.alpha_composite(laag, (int(cx - maat), int(cy - maat)))


def teken_tegelrij(img, top, hoogte, marge):
    """Rij houten tegels 1-9 bovenin, een paar 'dichtgeklapt'."""
    breedte = img.width - 2 * marge
    d = ImageDraw.Draw(img)
    n = 9
    tussen = hoogte * 0.12
    tw = (breedte - (n - 1) * tussen) / n
    dicht = {3, 7}  # willekeurige tegels naar beneden
    for i in range(n):
        x0 = marge + i * (tw + tussen)
        if (i + 1) in dicht:
            afgerond(d, [x0, top + hoogte * 0.55, x0 + tw, top + hoogte],
                     hoogte * 0.08, fill=(51, 34, 12))
        else:
            afgerond(d, [x0, top, x0 + tw, top + hoogte], hoogte * 0.08,
                     fill=(181, 122, 53), outline=(107, 68, 21), width=max(2, int(hoogte * 0.03)))


def maak_icoon(maat, maskable, pad):
    img = Image.new("RGBA", (maat, maat), ACHTERGROND + (255,))
    d = ImageDraw.Draw(img)
    if not maskable:
        # afgeronde hoeken via masker
        mask = Image.new("L", (maat, maat), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, maat, maat], radius=maat * 0.22, fill=255)
        img.putalpha(mask)
    # houten paneel
    marge = maat * (0.16 if maskable else 0.06)
    afgerond(d, [marge, maat * 0.30, maat - marge, maat * 0.94],
             maat * 0.05, fill=HOUT_1 + (255,), outline=(61, 44, 23), width=max(2, maat // 128))
    # accentrand
    d.rounded_rectangle([marge, maat * 0.30, maat - marge, maat * 0.94],
                        radius=maat * 0.05, outline=ACCENT + (255,), width=max(2, maat // 100))
    midden = (maat * 0.30 + maat * 0.94) / 2  # verticaal midden van het paneel
    die_maat = int(maat * (0.24 if maskable else 0.28))
    teken_dobbelsteen(img, maat * 0.40, midden, die_maat, -12, 5)
    teken_dobbelsteen(img, maat * 0.66, midden + maat * 0.02, die_maat, 14, 3)
    teken_tegelrij(img, maat * 0.055, maat * 0.115, maat * 0.055)
    img.save(pad)
    print("geschreven:", pad)


basis = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(basis, exist_ok=True)
maak_icoon(192, False, os.path.join(basis, "icon-192.png"))
maak_icoon(512, False, os.path.join(basis, "icon-512.png"))
maak_icoon(512, True, os.path.join(basis, "icon-512-maskable.png"))
