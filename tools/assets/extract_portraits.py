#!/usr/bin/env python3
"""Extract standing talk portraits for every unit from the owner's dump.

For each unit in the data pack the script reads the neutral (``通常``)
standing talk sprite from ``face/face/<name>_st.arc``, merges the character's
hair (``face/hair/<hair>/髪0.bch.lz`` tinted with the FaceData hair colour,
mirroring the ``_bu`` face pipeline; regular units have the hair baked into
the body texture), trims the canvas to the alpha content plus the crop boxes,
and writes an optimised WebP to ``public/assets/portraits/<slot>.webp``.

Crop boxes come from FaceData (see docs/ASSETS.md "Talk portraits (v3)"):

  - face: the 128x128 face rect at record +40 (top of hair to chin), grown by
    a 10% margin per side.
  - bust: the game's 110x218 bust rect at record +48, widened to a square of
    its height, centred on the rect; the eye rect at +56 confirms the eye
    line sits near the top third of the card, as the design asks.

The script writes ``src/data/portraits.json`` (unit id -> file, size, crop
boxes, provenance), prints a coverage report, and renders
``docs/screenshots/v3/portraits.png`` (every face crop at 64px and bust crop
at 115px with names) for review. Run it from the repo root:

    python tools/assets/extract_portraits.py

The BCH/LZ13/pixel decoders live in tools/assets/fe_assets.py; Pillow is the
only third-party dependency.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
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

FACE_MARGIN = 0.10
MAX_HEIGHT = 512
WEBP_QUALITY = 85

# The avatar's fid is player-configured; FaceData ships default ST records per gender.
AVATAR_FALLBACK_FSID = {
    "male": "FSID_ST_マイユニ_男1_顔A",
    "female": "FSID_ST_マイユニ_女1_顔A",
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


def portrait_normal_texture(romfs: str, portrait: str, lz13):
    path = os.path.join(romfs, "face", "face", f"{portrait}.arc")
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
        name = archive.read_string(entry)
        offset = struct.unpack_from("<I", raw, entry + 12)[0]
        if name and name.startswith("通常"):
            chosen = archive.data_offset + data_label + offset
            break
    if chosen is None:
        return None
    length = fe_assets.lz13_blob_length(raw, chosen)
    if not length:
        return None
    blob = lz13.decompress(raw[chosen : chosen + length])
    textures = fe_assets.bch_textures(blob)
    return textures[0] if textures else None


def tint_overlay(image: Image.Image, color: bytes) -> Image.Image:
    """Paragon-style overlay blend, tinting a white hair texture."""
    if color[:3] == b"\x00\x00\x00":
        return image
    lut = []
    for channel in range(3):
        base = color[channel]
        for value in range(256):
            a = value / 256.0
            b = base / 256.0
            blended = 2 * a * b if a < 0.5 else 1 - 2 * (1 - a) * (1 - b)
            lut.append(int(blended * 256))
    rgb = image.convert("RGB").point(lut)
    result = Image.new("RGBA", image.size)
    result.paste(rgb, mask=image.getchannel("A"))
    result.putalpha(image.getchannel("A"))
    return result


# ----------------------------- crop boxes -----------------------------------


def crop_boxes(info: dict) -> tuple[list[int], list[int]] | None:
    """Face and bust squares in texture pixels, derived from FaceData."""
    face = info["face"]
    bust = info["bust"]
    if not face[2] or not face[3] or not bust[2] or not bust[3]:
        return None
    face_side = round(face[2] * (1 + 2 * FACE_MARGIN))
    face_cx = face[0] + face[2] / 2
    face_cy = face[1] + face[3] / 2
    face_box = [round(face_cx - face_side / 2), round(face_cy - face_side / 2), face_side, face_side]
    bust_side = bust[3]
    bust_cx = bust[0] + bust[2] / 2
    bust_box = [round(bust_cx - bust_side / 2), bust[1], bust_side, bust_side]
    return face_box, bust_box


def extract_unit_portrait(romfs: str, info: dict, lz13):
    texture = portrait_normal_texture(romfs, info["portrait"], lz13)
    if texture is None:
        return None, "no portrait arc"
    image = Image.frombytes("RGBA", (texture.width, texture.height), texture.rgba)

    if info["hair"]:
        hair_path = os.path.join(romfs, "face", "hair", info["hair"], "髪0.bch.lz")
        if os.path.isfile(hair_path):
            hair_texture = fe_assets.bch_textures(lz13.decompress(open(hair_path, "rb").read()))[0]
            if hair_texture.width == texture.width and hair_texture.height == texture.height:
                hair = Image.frombytes(
                    "RGBA", (hair_texture.width, hair_texture.height), hair_texture.rgba
                )
                image.alpha_composite(tint_overlay(hair, info["hair_color"]))

    boxes = crop_boxes(info)
    if boxes is None:
        return None, "invalid FaceData rects"
    face, bust = boxes

    content = image.getchannel("A").getbbox()
    if content is None:
        return None, "empty portrait texture"
    x0 = min(content[0], face[0], bust[0])
    y0 = min(content[1], face[1], bust[1])
    x1 = max(content[2], face[0] + face[2], bust[0] + bust[2])
    y1 = max(content[3], face[1] + face[3], bust[1] + bust[3])

    cropped = Image.new("RGBA", (x1 - x0, y1 - y0))
    cropped.paste(image, (-x0, -y0), image)

    scale = min(1.0, MAX_HEIGHT / cropped.height)
    if scale < 1.0:
        size = (round(cropped.width * scale), round(cropped.height * scale))
        cropped = cropped.resize(size, Image.LANCZOS)

    def to_image(box: list[int]) -> list[int]:
        return [
            round((box[0] - x0) * scale),
            round((box[1] - y0) * scale),
            round(box[2] * scale),
            round(box[3] * scale),
        ]

    eyes = info["eyes"]
    eye_line = None
    if 0 < eyes[2] < 1000 and 0 < eyes[3] < 1000:
        eye_line = (eyes[1] + eyes[3] / 2 - bust[1]) / bust[3]
    return {"image": cropped, "face": to_image(face), "bust": to_image(bust), "eye_line": eye_line}, None


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
    face_rows = (len(rows) + SHEET_COLUMNS - 1) // SHEET_COLUMNS
    bust_rows = face_rows
    face_block = face_rows * (FACE_CHIP + SHEET_LABEL)
    bust_block = bust_rows * (BUST_CARD + SHEET_LABEL)
    width = SHEET_PAD * 2 + SHEET_COLUMNS * SHEET_CELL - SHEET_GAP
    height = SHEET_PAD * 2 + 2 * 56 + face_block + bust_block + 24
    sheet = Image.new("RGB", (width, height), "#f6f6f6")
    draw = ImageDraw.Draw(sheet)

    def draw_text_centered(x: float, y: float, text: str, font) -> None:
        draw.text((x - draw.textlength(text, font=font) / 2, y), text, font=font, fill="#1b1b1b")

    y = SHEET_PAD
    draw.text((SHEET_PAD, y), f"Talk portraits — face crop ({FACE_CHIP}px)", font=title_font, fill="#1b1b1b")
    y += 56
    for index, row in enumerate(rows):
        with Image.open(os.path.join(out_dir, os.path.basename(row["entry"]["file"]))) as opened:
            portrait = opened.convert("RGBA")
        x, yy, w, h = row["entry"]["face"]
        face = portrait.crop((x, yy, x + w, y + h)).resize((FACE_CHIP, FACE_CHIP), Image.LANCZOS)
        cell_x = SHEET_PAD + (index % SHEET_COLUMNS) * SHEET_CELL
        cell_y = y + (index // SHEET_COLUMNS) * (FACE_CHIP + SHEET_LABEL)
        sheet.paste(face, (cell_x + (SHEET_CELL - SHEET_GAP - FACE_CHIP) // 2, cell_y), face)
        draw_text_centered(cell_x + (SHEET_CELL - SHEET_GAP) / 2, cell_y + FACE_CHIP + 3, row["name"], body_font)
    y += face_block + 24
    draw.text((SHEET_PAD, y), f"Talk portraits — bust crop ({BUST_CARD}px)", font=title_font, fill="#1b1b1b")
    y += 56
    for index, row in enumerate(rows):
        with Image.open(os.path.join(out_dir, os.path.basename(row["entry"]["file"]))) as opened:
            portrait = opened.convert("RGBA")
        x, yy, w, h = row["entry"]["bust"]
        bust = portrait.crop((x, yy, x + w, yy + h)).resize((BUST_CARD, BUST_CARD), Image.LANCZOS)
        cell_x = SHEET_PAD + (index % SHEET_COLUMNS) * SHEET_CELL
        cell_y = y + (index // SHEET_COLUMNS) * (BUST_CARD + SHEET_LABEL)
        sheet.paste(bust, (cell_x + (SHEET_CELL - SHEET_GAP - BUST_CARD) // 2, cell_y), bust)
        draw_text_centered(cell_x + (SHEET_CELL - SHEET_GAP) / 2, cell_y + BUST_CARD + 3, row["name"], body_font)

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

    entries = {}
    rows = []
    missing = []
    eye_lines = []
    for unit in units:
        fid = unit.get("fid") or ""
        part = fid[4:] if fid.startswith("FID_") else ""
        info = faces.get(f"FSID_ST_{part}")
        if not info and unit.get("isCorrin"):
            info = faces.get(AVATAR_FALLBACK_FSID[unit["gender"]])
        if not info or not info["portrait"]:
            missing.append((unit["id"], unit["name"], "no ST FaceData entry"))
            continue
        result, error = extract_unit_portrait(args.romfs, info, lz13)
        if error:
            missing.append((unit["id"], unit["name"], error))
            continue
        image = result["image"]
        file_name = f"assets/portraits/{unit['slot']}.webp"
        out_path = os.path.join(args.out, f"{unit['slot']}.webp")
        os.makedirs(args.out, exist_ok=True)
        image.save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)
        entry = {
            "file": file_name,
            "w": image.width,
            "h": image.height,
            "face": result["face"],
            "bust": result["bust"],
            "source": f"face/face/{info['portrait']}.arc#通常 + hair",
        }
        entries[unit["id"]] = entry
        rows.append({"name": unit["name"], "entry": entry})
        if result["eye_line"] is not None:
            eye_lines.append(result["eye_line"])

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

    total_bytes = sum(os.path.getsize(os.path.join(args.out, f"{u['slot']}.webp")) for u in units if u["id"] in entries)
    print(f"portraits: {len(entries)}/{len(units)} ({100 * len(entries) / max(len(units), 1):.1f}%)")
    for entry in missing:
        print(f"  missing portrait: {entry}")
    print(f"total size: {total_bytes / 1024:.0f} KiB ({total_bytes / max(len(entries), 1) / 1024:.1f} KiB avg)")
    if eye_lines:
        print(
            f"eye line in bust box: {statistics.mean(eye_lines) * 100:.0f}% "
            f"({min(eye_lines) * 100:.0f}-{max(eye_lines) * 100:.0f}%)"
        )
    write_contact_sheet(rows, args.out, args.contact_sheet)
    print(f"manifest: {os.path.relpath(args.manifest, REPO_ROOT)}")
    print(f"contact sheet: {os.path.relpath(args.contact_sheet, REPO_ROOT)}")


if __name__ == "__main__":
    main()
