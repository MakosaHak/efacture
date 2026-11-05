# -*- coding: utf-8 -*-
"""Génère logo.png / icon-192.png / icon-512.png / apple-touch-icon.png / favicon.png.

Style « saphir / minéral » : carré arrondi dégradé navy → saphir → bleu électrique,
reçu blanc à bord dentelé, coins de scan cyan et coche menthe.
"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
OUT = os.path.join(PUBLIC, "icons")

NAVY = (15, 23, 42)
SAPPHIRE = (30, 58, 138)
ELECTRIC = (37, 99, 235)
CYAN = (6, 182, 212)
MINT = (16, 185, 129)
LINE = (148, 163, 184)
WHITE = (255, 255, 255)

SS = 4  # suréchantillonnage pour l'anticrénelage


def _font(size: int, bold: bool = False):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _gradient(size: int) -> Image.Image:
    """Dégradé diagonal navy (bas-gauche) → saphir → électrique (haut-droite)."""
    g = Image.new("RGB", (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + (size - y)) / (2 * size)
            if t < 0.5:
                a, b, k = NAVY, SAPPHIRE, t / 0.5
            else:
                a, b, k = SAPPHIRE, ELECTRIC, (t - 0.5) / 0.5
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
    return g


def _icon(size: int, rounded: bool = True) -> Image.Image:
    S = size * SS
    base = _gradient(S).convert("RGBA")

    # halo cyan en bas à droite
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([S * 0.45, S * 0.5, S * 1.25, S * 1.3], fill=CYAN + (90,))
    base.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.12)))

    d = ImageDraw.Draw(base)

    # reçu blanc à bord dentelé
    l, r, t, b = S * 0.31, S * 0.69, S * 0.22, S * 0.74
    teeth = 5
    tw = (r - l) / teeth
    pts = [(l, t), (r, t), (r, b)]
    for i in range(teeth):
        x1 = r - i * tw
        pts += [(x1 - tw / 2, b - tw * 0.45), (x1 - tw, b)]
    pts.append((l, t))
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon([(x + S * 0.012, y + S * 0.02) for x, y in pts], fill=NAVY + (110,))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(S * 0.015)))
    d = ImageDraw.Draw(base)
    d.polygon(pts, fill=WHITE)

    # lignes du reçu
    lh = S * 0.028
    for i, w in enumerate([0.70, 0.50, 0.62]):
        y = t + S * 0.08 + i * S * 0.075
        d.rounded_rectangle([l + S * 0.05, y, l + S * 0.05 + (r - l - S * 0.1) * w, y + lh], radius=lh / 2, fill=LINE)
    # ligne total en saphir
    y = t + S * 0.08 + 3 * S * 0.075
    d.rounded_rectangle([l + S * 0.05, y, r - S * 0.05, y + lh * 1.2], radius=lh / 2, fill=SAPPHIRE)

    # coins de scan cyan
    cw, cl = S * 0.035, S * 0.11
    m0, m1 = S * 0.16, S * 0.84
    for cx, cy, sx, sy in [(m0, m0, 1, 1), (m1, m0, -1, 1), (m0, m1, 1, -1), (m1, m1, -1, -1)]:
        d.line([(cx, cy + sy * cl), (cx, cy), (cx + sx * cl, cy)], fill=CYAN, width=int(cw), joint="curve")
        for px_, py_ in [(cx, cy + sy * cl), (cx + sx * cl, cy)]:
            d.ellipse([px_ - cw / 2, py_ - cw / 2, px_ + cw / 2, py_ + cw / 2], fill=CYAN)

    # badge coche menthe
    bx, by, br = S * 0.68, S * 0.70, S * 0.13
    d.ellipse([bx - br - S * 0.02, by - br - S * 0.02, bx + br + S * 0.02, by + br + S * 0.02], fill=WHITE)
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=MINT)
    d.line(
        [(bx - br * 0.45, by + br * 0.02), (bx - br * 0.1, by + br * 0.38), (bx + br * 0.5, by - br * 0.32)],
        fill=WHITE,
        width=int(S * 0.035),
        joint="curve",
    )

    if rounded:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        base.putalpha(mask)

    return base.resize((size, size), Image.LANCZOS)


def make_logo(path: str) -> None:
    w, h = 612, 408
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    icon = _icon(176)
    im.alpha_composite(icon, ((w - icon.width) // 2, 40))
    d = ImageDraw.Draw(im)
    font = _font(52, bold=True)
    tw = d.textbbox((0, 0), "efacture", font=font)[2]
    x = (w - tw) // 2
    d.text((x, 240), "e", font=font, fill=ELECTRIC)
    d.text((x + d.textbbox((0, 0), "e", font=font)[2], 240), "facture", font=font, fill=NAVY)
    im.save(path, "PNG")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    make_logo(os.path.join(OUT, "logo.png"))
    _icon(192).save(os.path.join(OUT, "icon-192.png"), "PNG")
    _icon(512).save(os.path.join(OUT, "icon-512.png"), "PNG")
    _icon(180, rounded=False).save(os.path.join(OUT, "apple-touch-icon.png"), "PNG")
    _icon(64).save(os.path.join(PUBLIC, "favicon.png"), "PNG")
    print("icones ok", OUT)


if __name__ == "__main__":
    main()
