#!/usr/bin/env python3
"""Extract portrait artwork for every unit from the owner's dump.

One artwork per unit (docs/ASSETS.md "Portrait artwork (v3.4)"):

- **Talk portrait**: the neutral (``通常``) standing sprite from
  ``face/face/<name>_st.arc``, with the character's recolourable hair layer
  (``face/hair/<name>_st/髪0.bch.lz``, tinted with the FaceData colour) composited
  when the unit has one. Crop boxes come from FaceData's 128x128 face rect (top of
  hair to chin): a tighter square inside it ("face chips"), a square around the head
  near its top ("relationship / picker cards"), and the rect itself (``faceRect``),
  which the character page hero uses to place and zoom the art.

Tinting is an overlay blend of the grey hair layer with the colour (``tint_overlay``, measured
against the game's own hair sheets); the map sprites keep their reference-grey multiply.
Units with a hair layer also get a same-canvas hair-only WebP; the app tints it at
run time for Corrin / children whose colour follows the run.

Writes ``public/assets/portraits/<slot>.webp`` (+ ``-hair`` variants),
``src/data/portraits.json`` and a review contact sheet. Run from the repo root:

    python tools/assets/extract_portraits.py
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO_ROOT, "tools", "assets"))

import fe_assets  # noqa: E402

DEFAULT_ROMFS = os.path.join(
    REPO_ROOT, "..", "3ds-games", "fe-fates", "work", "cia-extract", "romfs"
)
DEFAULT_FE_TOOLS = os.path.join(REPO_ROOT, "..", "3ds-games", "fe-fates", "tools")
DEFAULT_PACK = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")
DEFAULT_OUT = os.path.join(REPO_ROOT, "public", "assets", "portraits")
DEFAULT_MANIFEST = os.path.join(REPO_ROOT, "src", "data", "portraits.json")
DEFAULT_CONTACT_SHEET = os.path.join(REPO_ROOT, "docs", "screenshots", "v3", "portraits.png")

# The game's face rect is "top of hair to chin" (128 square). Face chips zoom into it (owner,
# 2026-10-04: "zoom in a bit more"), trimming more of the hair top than the chin.
FACE_CHIP_SIDE = 108
FACE_CHIP_TRIM_TOP = 0.7
# Relationship / picker cards: a square around the head, its top a little above the face rect
# (owner references 2026-10-03; zoomed in from 248 / 28 on 2026-10-04).
BUST_BOX = 196
BUST_TOP_OFFSET = 22

WEBP_QUALITY = 85

# The avatar's fid is player-configured; FaceData ships default ST records per gender and build.
# Female Corrin uses body build 2 (owner, 2026-10-04); extract_sprites.py › AVATAR_HEAD_FOLDER matches.
AVATAR_FALLBACK_FSID = {
    "male": "FSID_ST_マイユニ_男1_顔A",
    "female": "FSID_ST_マイユニ_女2_顔A",
}

FACE_CHIP = 64
BUST_CARD = 115
SHEET_COLUMNS = 10
SHEET_GAP = 12
SHEET_PAD = 24
SHEET_CELL = BUST_CARD + SHEET_GAP
SHEET_LABEL = 20


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load_lz13(fe_tools_path: str):
    path = os.path.abspath(fe_tools_path)
    if not os.path.isfile(os.path.join(path, "fe_tools", "lz13.py")):
        fail(f"fe_tools not found under {path} (pass --fe-tools)")
    sys.path.insert(0, path)
    from fe_tools import lz13  # noqa: PLC0415

    return lz13


def read_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ------------------------------ FaceData -----------------------------------


def parse_face_data(romfs: str, lz13) -> dict:
    path = os.path.join(romfs, "face", "FaceData.bin.lz")
    if not os.path.isfile(path):
        fail(f"missing {path}")
    raw = lz13.decompress(open(path, "rb").read())
    count = struct.unpack_from("<I", raw, 0x20)[0]

    def string_at(ptr: int) -> str:
        if not ptr:
            return ""
        start = ptr + 0x20
        end = raw.index(b"\x00", start)
        return raw[start:end].decode("shift_jis", errors="replace")

    faces = {}
    for index in range(count):
        record = raw[0x24 + index * 72 : 0x24 + (index + 1) * 72]
        fsid = string_at(struct.unpack_from("<I", record, 0)[0])
        faces[fsid] = {
            "portrait": string_at(struct.unpack_from("<I", record, 12)[0]),
            "hair": string_at(struct.unpack_from("<I", record, 20)[0]),
            "hair_color": record[28:31],
            "face": struct.unpack_from("<HHHH", record, 40),
            "bust": struct.unpack_from("<HHHH", record, 48),
            "eyes": struct.unpack_from("<HHHH", record, 56),
        }
    return faces


# ------------------------------- pixels -------------------------------------


def arc_bch_texture(romfs: str, arc_name: str, entry_prefix: str | None, lz13, entry_index: int = 0):
    """First texture of the first arc entry whose name starts with ``entry_prefix``."""
    path = os.path.join(romfs, "face", "face", f"{arc_name}.arc")
    if not os.path.isfile(path):
        return None
    raw = open(path, "rb").read()
    archive = fe_assets.BinArchive(raw)
    data_label = next((a for a, labels in archive.labels.items() if labels == ["Data"]), None)
    count_label = next((a for a, labels in archive.labels.items() if labels == ["Count"]), None)
    info_label = next((a for a, labels in archive.labels.items() if "Info" in labels), None)
    if data_label is None or info_label is None:
        return None
    count = struct.unpack_from("<I", raw, archive.data_offset + count_label)[0]
    chosen = None
    for index in range(count):
        entry = archive.data_offset + info_label + index * 16
        name = archive.label_at(info_label + index * 16)
        offset = struct.unpack_from("<I", raw, entry + 12)[0]
        if entry_prefix is None or (name and name.startswith(entry_prefix)):
            chosen = archive.data_offset + data_label + offset
            break
    if chosen is None:
        return None
    length = fe_assets.lz13_blob_length(raw, chosen)
    if not length:
        return None
    blob = lz13.decompress(raw[chosen : chosen + length])
    textures = fe_assets.bch_textures(blob)
    return textures[entry_index] if len(textures) > entry_index else None


def hair_texture(romfs: str, hair_dir: str, lz13):
    path = os.path.join(romfs, "face", "hair", hair_dir, "髪0.bch.lz")
    if not os.path.isfile(path):
        return None
    textures = fe_assets.bch_textures(lz13.decompress(open(path, "rb").read()))
    return textures[0] if textures else None


def to_image(texture) -> Image.Image:
    return Image.frombytes("RGBA", (texture.width, texture.height), texture.rgba)


def tint_overlay(image: Image.Image, color: bytes) -> Image.Image:
    """Recolourable-hair tint for talk portraits and cut-ins: an overlay blend with the grey hair
    layer as the base - ``2*g*c`` below mid-grey, ``1 - 2*(1-g)*(1-c)`` above (0..1 values).

    Measured (2026-10-03) against the Fire Emblem Wiki's in-game child hair sheets (SereneSeas, 19
    children x Corrin's 30 colours, 1.2M hair pixels registered to these textures): overlay MAE 9.7,
    the sheets' own offset on untinted pixels (~+9); ``grey*colour/0xBB`` (the map sprites' formula)
    33.2, multiply x2 10.1, soft light 15.1. Keeps the layer's alpha (4-bit edges stay soft). Mirrored
    in src/components/art.tsx > tintTables('overlay').
    """
    lut = []
    for channel in range(3):
        c = color[channel]
        for g in range(256):
            value = (2 * g * c) // 255 if g < 128 else 255 - (2 * (255 - g) * (255 - c)) // 255
            lut.append(max(0, min(255, value)))
    rgb = image.convert("RGB").point(lut)
    result = rgb.convert("RGBA")
    result.putalpha(image.getchannel("A"))
    return result


def composite_hair(base: Image.Image, hair: Image.Image | None, colour: bytes | None) -> Image.Image:
    """Base with the recolourable hair layer tinted ``colour`` drawn over it."""
    if hair is None or colour is None:
        return base
    result = base.copy()
    result.alpha_composite(tint_overlay(hair, colour))
    return result


# ----------------------------- crop boxes -----------------------------------


def portrait_boxes(info: dict) -> tuple[list[int], list[int], list[int]] | None:
    """Face-chip, relationship-card and raw FaceData face boxes (squares) in texture pixels."""
    fx, fy, fw, fh = info["face"]
    if not fw or not fh:
        return None
    face_side = min(fw, fh)
    chip = min(FACE_CHIP_SIDE, face_side)
    face_box = [
        int(round(fx + (face_side - chip) / 2)),
        int(round(fy + (face_side - chip) * FACE_CHIP_TRIM_TOP)),
        chip,
        chip,
    ]
    # relationship box: square around the head, top a little above the face rect
    top = max(0, fy - BUST_TOP_OFFSET)
    side = min(BUST_BOX, 256 - top)
    cx = fx + fw / 2
    left = int(round(min(max(cx - side / 2, 0), 256 - side)))
    return face_box, [left, top, side, side], [fx, fy, face_side, face_side]


def build_unit_art(romfs: str, info: dict, lz13):
    """Talk portrait canvas (trimmed to content + boxes) and its boxes."""
    texture = arc_bch_texture(romfs, info["portrait"], "通常", lz13)
    if texture is None:
        return None, "no portrait arc"
    base = to_image(texture)

    hair_tex = hair_texture(romfs, info["hair"], lz13) if info["hair"] else None
    hair = to_image(hair_tex) if hair_tex is not None else None
    if hair is not None and (hair.width != texture.width or hair.height != texture.height):
        hair = None

    boxes = portrait_boxes(info)
    if boxes is None:
        return None, "invalid FaceData face rect"
    face, bust, face_rect = boxes

    content = base.getchannel("A").getbbox()
    if content is None:
        return None, "empty portrait texture"
    x0 = min(content[0], face[0], bust[0])
    y0 = min(content[1], face[1], bust[1])
    x1 = max(content[2], face[0] + face[2], bust[0] + bust[2])
    y1 = max(content[3], face[1] + face[3], bust[1] + bust[3])
    box = (x0, y0, x1, y1)

    def shift(box_rect: list[int]) -> list[int]:
        return [box_rect[0] - x0, box_rect[1] - y0, box_rect[2], box_rect[3]]

    return {
        "base": base,
        "hair": hair,
        "box": box,
        "face": shift(face),
        "bust": shift(bust),
        "face_rect": shift(face_rect),
    }, None


# ------------------------------ contact sheet --------------------------------


def load_font(size: int):
    for name in ("segoeui.ttf", "arial.ttf"):
        path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", name)
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def write_contact_sheet(rows: list[dict], out_dir: str, path: str) -> None:
    body_font = load_font(13)
    title_font = load_font(20)
    row_count = (len(rows) + SHEET_COLUMNS - 1) // SHEET_COLUMNS
    face_block = row_count * (FACE_CHIP + SHEET_LABEL)
    bust_block = row_count * (BUST_CARD + SHEET_LABEL)
    width = SHEET_PAD * 2 + SHEET_COLUMNS * SHEET_CELL - SHEET_GAP
    height = SHEET_PAD * 2 + 2 * 56 + face_block + bust_block + 24
    sheet = Image.new("RGB", (width, height), "#f6f6f6")
    draw = ImageDraw.Draw(sheet)

    def draw_text_centered(x: float, y: float, text: str, font) -> None:
        draw.text((x - draw.textlength(text, font=font) / 2, y), text, font=font, fill="#1b1b1b")

    def cell_x(index: int) -> int:
        return SHEET_PAD + (index % SHEET_COLUMNS) * SHEET_CELL

    def place(art: Image.Image, index: int, y: int, card: int) -> None:
        cy = y + (index // SHEET_COLUMNS) * (card + SHEET_LABEL)
        sheet.paste(art, (cell_x(index) + (SHEET_CELL - SHEET_GAP - art.width) // 2, cy), art)
        # Label under the art itself: cut-ins are half as tall as their row, and a label at the row
        # pitch read as the caption of the next row's art.
        draw_text_centered(cell_x(index) + (SHEET_CELL - SHEET_GAP) / 2, cy + art.height + 3, rows[index]["name"], body_font)

    def load(file_name: str) -> Image.Image:
        with Image.open(os.path.join(out_dir, os.path.basename(file_name))) as opened:
            return opened.convert("RGBA")

    y = SHEET_PAD
    draw.text((SHEET_PAD, y), f"Talk portrait - face crop ({FACE_CHIP}px)", font=title_font, fill="#1b1b1b")
    y += 56
    for index, row in enumerate(rows):
        x, yy, w, h = row["entry"]["face"]
        full = load(row["entry"]["file"])
        place(full.crop((x, yy, x + w, yy + h)).resize((FACE_CHIP, FACE_CHIP), Image.LANCZOS), index, y, FACE_CHIP)
    y += face_block + 24

    draw.text((SHEET_PAD, y), f"Talk portrait - card crop ({BUST_CARD}px)", font=title_font, fill="#1b1b1b")
    y += 56
    for index, row in enumerate(rows):
        x, yy, w, h = row["entry"]["bust"]
        full = load(row["entry"]["file"])
        place(full.crop((x, yy, x + w, yy + h)).resize((BUST_CARD, BUST_CARD), Image.LANCZOS), index, y, BUST_CARD)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path)


# --------------------------------- main ------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--romfs", default=DEFAULT_ROMFS)
    parser.add_argument("--fe-tools", default=DEFAULT_FE_TOOLS)
    parser.add_argument("--pack", default=DEFAULT_PACK)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--contact-sheet", default=DEFAULT_CONTACT_SHEET)
    args = parser.parse_args()

    lz13 = load_lz13(args.fe_tools)
    units = read_json(os.path.join(args.pack, "units.json"))["units"]
    faces = parse_face_data(args.romfs, lz13)
    sprites_manifest = read_json(os.path.join(REPO_ROOT, "src", "data", "sprites.json"))
    corrin_default = sprites_manifest.get("corrinHairColours", ["#f6f4ef"])[0]
    corrin_rgb = bytes(int(corrin_default.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
    os.makedirs(args.out, exist_ok=True)

    entries = {}
    rows = []
    missing = []
    hair_units = 0
    for unit in units:
        fid = unit.get("fid") or ""
        part = fid[4:] if fid.startswith("FID_") else ""
        info = faces.get(f"FSID_ST_{part}")
        if not info and unit.get("isCorrin"):
            info = faces.get(AVATAR_FALLBACK_FSID[unit["gender"]])
        if not info or not info["portrait"]:
            missing.append((unit["id"], unit["name"], "no ST FaceData entry"))
            continue
        colour = corrin_rgb if unit.get("isCorrin") else info["hair_color"]
        art, error = build_unit_art(args.romfs, info, lz13)
        if error:
            missing.append((unit["id"], unit["name"], error))
            continue

        base = composite_hair(art["base"], art["hair"], colour)
        canvas = base.crop(art["box"])
        key = f"{unit['slot']}"
        file_name = f"assets/portraits/{key}.webp"
        canvas.save(os.path.join(args.out, f"{key}.webp"), "WEBP", quality=WEBP_QUALITY, method=6)
        entry = {
            "file": file_name,
            "w": canvas.width,
            "h": canvas.height,
            "face": art["face"],
            "bust": art["bust"],
            "faceRect": art["face_rect"],
            "source": f"face/face/{info['portrait']}.arc#通常" + (" + hair" if art["hair"] else ""),
        }
        if art["hair"] is not None:
            hair_canvas = art["hair"].crop(art["box"])
            hair_name = f"assets/portraits/{key}-hair.webp"
            hair_canvas.save(os.path.join(args.out, f"{key}-hair.webp"), "WEBP", quality=WEBP_QUALITY, method=6)
            entry["hair"] = {"file": hair_name, "w": hair_canvas.width, "h": hair_canvas.height}
            hair_units += 1

        entries[unit["id"]] = entry
        rows.append({"name": unit["name"], "entry": entry})

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Owner's romfs dump (work/cia-extract/romfs) via tools/assets/extract_portraits.py",
        "coverage": {"resolved": len(entries), "total": len(units)},
        "units": entries,
    }
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)
    with open(args.manifest, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    total_bytes = 0
    for name in os.listdir(args.out):
        total_bytes += os.path.getsize(os.path.join(args.out, name))
    print(f"portraits: {len(entries)}/{len(units)} ({100 * len(entries) / max(len(units), 1):.1f}%)")
    print(f"hair layers: {hair_units}")
    for m in missing:
        print(f"  missing portrait: {m}")
    print(f"total size: {total_bytes / 1024:.0f} KiB ({total_bytes / max(len(rows), 1) / 1024:.1f} KiB avg)")
    write_contact_sheet(rows, args.out, args.contact_sheet)
    print(f"manifest: {args.manifest}")
    print(f"contact sheet: {args.contact_sheet}")


if __name__ == "__main__":
    main()
