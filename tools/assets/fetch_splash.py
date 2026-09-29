"""Splash art (character-page header): official Fire Emblem Fates artwork, sourced online.

The one asset set not taken from the romfs dump (owner-approved, docs/ASSETS.md). Steps:

1. Select: list Fire Emblem Wiki's ``FEF_*`` files and pick, per unit, the largest *full* artwork —
   the wiki's 1000px-tall files are portrait busts and anything under 700px is a thumbnail, so both
   are skipped unless nothing else exists. The choice is pinned in ``splash_sources.json``
   (``--refresh-sources`` re-selects).
2. Fetch originals into ``tools/assets/.cache/splash/`` (gitignored).
3. Face position: hand-placed in ``splash_focus.json`` (the detector misses most of Kozaki's
   three-quarter faces); units without an entry use the lbpcascade_animeface detector, else the
   top of the figure.
4. Bake the header crop: a 390:316 box about five face-heights tall, centred on the face with the
   face at 35% of its height (fallback: the upper 45% of the figure). Saved as WebP at 2× the
   mobile header size in ``public/assets/splash/<slot>.webp``; ``src/data/splash.json`` records
   the face position inside the crop.
5. Contact sheet ``docs/screenshots/v3/splash.png`` of every header crop.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "tools/assets/.cache/splash"
SOURCES = ROOT / "tools/assets/splash_sources.json"
FOCUS = ROOT / "tools/assets/splash_focus.json"
OUT_DIR = ROOT / "public/assets/splash"
MANIFEST = ROOT / "src/data/splash.json"
SHEET = ROOT / "docs/screenshots/v3/splash.png"
CASCADE_URL = "https://raw.githubusercontent.com/nagadomi/lbpcascade_animeface/master/lbpcascade_animeface.xml"
WIKI_API = "https://fireemblemwiki.org/w/api.php"
UA = {"User-Agent": "fates-expanded-planner/3 (personal fan planner; splash art fetch)"}

QUALITY = 82
BUST_HEIGHT = 1000
THUMB_HEIGHT = 700
# Mobile header size (docs/design/SPEC.md); crops are stored at 2× for high-DPI screens.
HEADER = (390, 316)
OUTPUT = (HEADER[0] * 2, HEADER[1] * 2)
FACE_LINE = 0.35
FACE_HEIGHTS = 5.0
FALLBACK_SHARE = 0.45

WIKI_KEY = {"Corrin (M)": "Avatar_Male", "Corrin (F)": "Avatar_Female", "Kana (M)": "Kana_Male", "Kana (F)": "Kana_Female"}


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def wiki_files() -> dict[str, dict]:
    files: dict[str, dict] = {}
    params = {"action": "query", "list": "allimages", "aiprefix": "FEF_", "aiprop": "url|size", "ailimit": "500", "format": "json"}
    while True:
        data = json.loads(get(f"{WIKI_API}?{urllib.parse.urlencode(params)}"))
        for image in data["query"]["allimages"]:
            files[image["name"]] = {"url": image["url"], "page": image["descriptionurl"], "w": image["width"], "h": image["height"]}
        if "continue" not in data:
            return files
        params.update(data["continue"])
        time.sleep(0.5)


def select_sources(units: list[dict]) -> dict[str, dict]:
    files = wiki_files()
    chosen: dict[str, dict] = {}
    for unit in units:
        key = WIKI_KEY.get(unit["name"], unit["name"].replace(" ", "_"))
        pattern = re.compile(rf"^FEF_{re.escape(key)}(_\d+)?\.(png|jpg)$", re.IGNORECASE)
        candidates = {name: meta for name, meta in files.items() if pattern.match(name)}
        full = {name: meta for name, meta in candidates.items() if meta["h"] != BUST_HEIGHT and meta["h"] >= THUMB_HEIGHT}
        pool = full or candidates
        if not pool:
            print(f"  no artwork for {unit['name']}", file=sys.stderr)
            continue
        name, meta = max(pool.items(), key=lambda item: item[1]["w"] * item[1]["h"])
        chosen[unit["id"]] = {
            "name": unit["name"],
            "file": name,
            "url": meta["url"],
            "page": meta["page"],
            "originalSize": [meta["w"], meta["h"]],
            "kind": "full artwork" if full else "portrait (no full artwork on the wiki)",
            "alternatives": sorted(n for n in candidates if n != name),
        }
    return chosen


def fetch(url: str) -> Image.Image:
    path = CACHE / Path(urllib.parse.urlparse(url).path).name
    if not path.exists():
        path.write_bytes(get(url))
        time.sleep(0.4)
    return Image.open(path)


def figure_box(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    return alpha.getbbox() or (0, 0, image.width, image.height)


def find_face(image: Image.Image, detector: cv2.CascadeClassifier) -> tuple[float, float, float, str]:
    """Face centre and height in image pixels, plus the method used."""
    scale = min(1.0, 1800 / max(image.size))
    small = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    flat = Image.new("RGB", small.size, "white")
    flat.paste(small, mask=small.getchannel("A"))
    gray = cv2.equalizeHist(cv2.cvtColor(np.asarray(flat), cv2.COLOR_RGB2GRAY))
    left, top, right, bottom = figure_box(small)
    minimum = max(24, int((bottom - top) * 0.035))
    faces = detector.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(minimum, minimum))
    faces = [face for face in faces if face[1] + face[3] / 2 < top + (bottom - top) * 0.55]
    if len(faces):
        x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
        return (x + w / 2) / scale, (y + h / 2) / scale, h / scale, "animeface"
    left, top, right, bottom = figure_box(image)
    band = np.asarray(image.getchannel("A").crop((left, top, right, top + max(1, (bottom - top) // 8))))
    columns = band.sum(axis=0)
    cx = left + (float(np.average(np.arange(len(columns)), weights=columns)) if columns.sum() else (right - left) / 2)
    box_h = (bottom - top) * FALLBACK_SHARE
    return cx, top + box_h * FACE_LINE, box_h / FACE_HEIGHTS, "figure-top"


def pinned_face(image: Image.Image, focus: dict) -> tuple[float, float, float, str]:
    left, top, right, bottom = figure_box(image)
    width, height = right - left, bottom - top
    return left + focus["x"] * width, top + focus["y"] * height, focus["face"] * height, "pinned"


def header_crop(image: Image.Image, cx: float, cy: float, face_h: float) -> Image.Image:
    """390:316 box around the face; areas outside the art stay transparent (the header shows the route wash)."""
    left, top, right, bottom = figure_box(image)
    box_h = min(max(face_h * FACE_HEIGHTS, 160), bottom - top)
    box_w = box_h * HEADER[0] / HEADER[1]
    left, top = cx - box_w / 2, cy - box_h * FACE_LINE
    crop = image.crop((round(left), round(top), round(left + box_w), round(top + box_h)))
    size = OUTPUT if box_h >= OUTPUT[1] else (round(box_w), round(box_h))
    return crop.resize(size, Image.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pack", default=str(ROOT / "src/data/packs/ugf-2.5.2"))
    parser.add_argument("--refresh-sources", action="store_true", help="re-select files from the wiki")
    args = parser.parse_args()

    units = json.loads((Path(args.pack) / "units.json").read_text(encoding="utf-8"))["units"]
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.refresh_sources or not SOURCES.exists():
        print("selecting sources from Fire Emblem Wiki…")
        SOURCES.write_text(json.dumps(select_sources(units), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))

    cascade = CACHE / "lbpcascade_animeface.xml"
    if not cascade.exists():
        cascade.write_bytes(get(CASCADE_URL))
    detector = cv2.CascadeClassifier(str(cascade))
    focus = json.loads(FOCUS.read_text(encoding="utf-8")) if FOCUS.exists() else {}

    manifest_units: dict[str, dict] = {}
    sheet_cells: list[tuple[str, Image.Image, str]] = []
    total = 0
    for unit in units:
        source = sources.get(unit["id"])
        if not source:
            continue
        original = fetch(source["url"]).convert("RGBA")
        cx, cy, face_h, method = pinned_face(original, focus[unit["id"]]) if unit["id"] in focus else find_face(original, detector)
        art = header_crop(original, cx, cy, face_h)
        focal = {"x": 0.5, "y": FACE_LINE}
        out = OUT_DIR / f"{unit['slot']}.webp"
        buffer = io.BytesIO()
        art.save(buffer, "WEBP", quality=QUALITY, method=6)
        out.write_bytes(buffer.getvalue())
        total += out.stat().st_size
        source["focalMethod"] = method
        manifest_units[unit["id"]] = {
            "file": f"assets/splash/{unit['slot']}.webp",
            "w": art.width,
            "h": art.height,
            "focal": focal,
            "source": source["page"],
        }
        backdrop = Image.new("RGBA", art.size, (23, 143, 134, 255))
        backdrop.alpha_composite(art)
        sheet_cells.append((unit["name"], backdrop, method))
        print(f"  {unit['name']:<12} {source['file']:<28} face {face_h:.0f}px -> {art.width}x{art.height} ({method})")

    SOURCES.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps({
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "Official Fire Emblem Fates artwork via Fire Emblem Wiki (tools/assets/splash_sources.json)",
        "coverage": {"resolved": len(manifest_units), "total": len(units)},
        "units": manifest_units,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    columns, cell_w, cell_h, label = 6, HEADER[0] // 2, HEADER[1] // 2, 18
    rows = (len(sheet_cells) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * (cell_w + 8) + 8, rows * (cell_h + label + 8) + 8), "#f6f6f6")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (name, crop, method) in enumerate(sheet_cells):
        x = 8 + (index % columns) * (cell_w + 8)
        y = 8 + (index // columns) * (cell_h + label + 8)
        sheet.paste(crop.resize((cell_w, cell_h), Image.LANCZOS).convert("RGB"), (x, y))
        draw.text((x, y + cell_h + 3), f"{name}{'' if method == 'animeface' else ' *'}", fill="#1b1b1b", font=font)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET)
    fallback = sum(1 for _, _, method in sheet_cells if method == "figure-top")
    print(f"\n{len(manifest_units)}/{len(units)} units, {total / 1024:.0f} KiB, {fallback} focal fallbacks (* on the sheet)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
