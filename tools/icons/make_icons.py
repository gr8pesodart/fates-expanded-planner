#!/usr/bin/env python3
"""Generate the PWA icon set from the same sigil as public/favicon.svg.

Run once after changing the icon design:

    python tools/icons/make_icons.py

Outputs (committed): public/icons/icon-192.png, icon-512.png,
icon-maskable-512.png, apple-touch-icon.png
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(REPO_ROOT, "public", "icons")

BG = (13, 16, 32, 255)
GOLD = (214, 178, 94, 255)
GOLD_LIGHT = (240, 217, 154, 255)
SUPERSAMPLE = 4


def render(size: int, maskable: bool = False) -> Image.Image:
    ss = size * SUPERSAMPLE
    img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        draw.rectangle([0, 0, ss, ss], fill=BG)
    else:
        draw.rounded_rectangle([0, 0, ss - 1, ss - 1], radius=int(ss * 0.22), fill=BG)

    # Sigil drawn in 64-unit coordinates, centered; maskable keeps a safe zone.
    k = ss / 64
    shrink = 0.56 if maskable else 0.78
    center = ss / 2

    def pt(x: float, y: float) -> tuple[float, float]:
        return (center + (x - 32) * k * shrink, center + (y - 32) * k * shrink)

    def w(units: float) -> int:
        return max(2, int(units * k * shrink))

    diamond = [pt(32, 7), pt(54, 32), pt(32, 57), pt(10, 32), pt(32, 7)]
    draw.line(diamond, fill=GOLD, width=w(2.8), joint="curve")

    draw.line([pt(23, 26), pt(41, 44)], fill=GOLD, width=w(2.2))
    draw.line([pt(41, 26), pt(23, 44)], fill=GOLD, width=w(2.2))
    draw.line([pt(32, 16), pt(32, 48)], fill=GOLD_LIGHT, width=w(2.8))

    dot = w(2.6)
    cx, cy = pt(32, 32)
    draw.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=GOLD_LIGHT)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    outputs = [
        ("icon-192.png", render(192)),
        ("icon-512.png", render(512)),
        ("icon-maskable-512.png", render(512, maskable=True)),
        ("apple-touch-icon.png", render(180, maskable=True)),
    ]
    for name, image in outputs:
        path = os.path.join(OUT_DIR, name)
        image.save(path)
        print(f"wrote {os.path.relpath(path, REPO_ROOT)}")


if __name__ == "__main__":
    main()
