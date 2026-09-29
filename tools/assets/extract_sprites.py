#!/usr/bin/env python3
"""Stitch FE Fates map sprites (class body + unit head) from the owner's dump.

FE Fates composes map sprites from two textures: the class body sheet
(`unit/Body/<class>/青0.bch.lz`) and the character head sheet
(`unit/Head/<character>/青0.bch.lz`), positioned by the class animation script
(`unit/Body/<class>/anime.bin`). Some class+character pairs have a full-body
override under `unit/Unique/<class>_<character>/` (Velouria's wolf forms,
Kana's nobles, Azura's Songstress dress, monsters).

The animation script's record layout is documented in docs/assets/anime-bin.md.
The idle/standing frame is animation 0, frame 0; its body source rect is the
frame the old single-texture class sprites showed, and its head source rect is
the cell the game draws over it. Head sheets carry two cells per expression:
the "large" 32x32 cell (0,0) used by foot classes and the "small" 16x16 cell
(0,32) used by mounted classes; they are separately drawn art, not scales of
each other, so both are exported where present.

Outputs (paths relative to the site base, mirrored under --out):

  - `assets/sprites/bodies/<classId>.webp`          idle-frame body cell
  - `assets/sprites/heads/<slot>.webp`              unit large head cell
  - `assets/sprites/heads/<slot>-small.webp`        unit small head cell
  - `assets/sprites/generic-heads/<classId>.webp`   class-generic head(s)
  - `assets/sprites/unique/<slot>-<classId>.webp`   unit+class body override
  - `src/data/sprites.json`                         manifest for the app
  - `docs/screenshots/v3/sprites.png`               gate contact sheet (4x)

Sprites are written at native pixel size; the app scales with
`image-rendering: pixelated`. The script reads `units.json` / `classes.json`
from the data pack and prints a coverage report. Run it from the repo root:

    python tools/assets/extract_sprites.py

The BCH/LZ13/pixel decoders live in tools/assets/fe_assets.py; Pillow is the
only third-party dependency.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
from dataclasses import dataclass
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
DEFAULT_OUT = os.path.join(REPO_ROOT, "public", "assets")
DEFAULT_MANIFEST = os.path.join(REPO_ROOT, "src", "data", "sprites.json")
DEFAULT_SHEET = os.path.join(REPO_ROOT, "docs", "screenshots", "v3", "sprites.png")

ARCHIVE_HEADER_SIZE = 8
ANIMATION_SIZE = 388
ANIMATION_HEADER_SIZE = 4
FRAMES_PER_ANIMATION = 16
FRAME_SIZE = 24
FRAME_STRUCT = "<bbbbhhbbbbhhii"

HEAD_FILE = "青0.bch.lz"

AVATAR_HEAD_FOLDER = {
    "male": "プレイヤー男1_01",
    "female": "プレイヤー女1_01",
}

CONTACT_SHEET = [
    ("Corrin (F) · Nohr Princess", "Nohr Princess (F)", "Corrin (F)"),
    ("Corrin (M) · Nohr Prince", "Nohr Prince (M)", "Corrin (M)"),
    ("Ryoma · Swordmaster", "Swordmaster (M)", "Ryoma"),
    ("Xander · Paladin", "Paladin (M)", "Xander"),
    ("Camilla · Malig Knight", "Malig Knight (F)", "Camilla"),
    ("Sakura · Priestess", "Priestess", "Sakura"),
    ("Kaze · Ninja", "Ninja (M)", "Kaze"),
    ("Velouria · Wolfskin", "Wolfskin (F)", "Velouria"),
    ("Keaton · Wolfssegner", "Wolfssegner (M)", "Keaton"),
    ("Kana (F) · Nohr Noble", "Nohr Noble (F)", "Kana (F)"),
    ("Azura · Songstress", "Songstress", "Azura"),
    ("Jakob · Butler", "Butler", "Jakob"),
    ("Ryoma as Great Knight", "Great Knight (M)", "Ryoma"),
    ("Sakura as Oni Savage", "Oni Savage (F)", "Sakura"),
    ("Xander as Wyvern Lord", "Wyvern Lord (M)", "Xander"),
    ("Azura as Sniper", "Sniper (F)", "Azura"),
]

FONT_CANDIDATES = (
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


sys.stdout.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class Frame:
    body_x: int
    body_y: int
    body_w: int
    body_h: int
    body_src_x: int
    body_src_y: int
    head_x: int
    head_y: int
    head_w: int
    head_h: int
    head_src_x: int
    head_src_y: int
    frame_index: int
    frame_delay: int


@dataclass
class Animation:
    is_used: int
    frame_count: int
    total_frames: int
    frames: list[Frame]


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


def write_webp(image: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "WEBP", lossless=True, quality=100, method=6)


def parse_animations(raw: bytes) -> list[Animation]:
    data = raw[0x20:]
    if len(data) < ARCHIVE_HEADER_SIZE:
        raise fe_assets.AssetError("animation archive too small")
    _uses_staff, count = struct.unpack_from("<ii", data, 0)
    animations = []
    for index in range(count):
        base = ARCHIVE_HEADER_SIZE + index * ANIMATION_SIZE
        if base + ANIMATION_SIZE > len(data):
            raise fe_assets.AssetError(f"animation {index} runs past the file")
        is_used, frame_count, total_frames, _padding = struct.unpack_from(
            "<BbBb", data, base
        )
        frames = []
        for slot in range(FRAMES_PER_ANIMATION):
            values = struct.unpack_from(
                FRAME_STRUCT, data, base + ANIMATION_HEADER_SIZE + slot * FRAME_SIZE
            )
            frames.append(Frame(*values))
        animations.append(Animation(is_used, frame_count, total_frames, frames))
    return animations


def idle_frame(anime_path: str) -> Frame:
    animations = parse_animations(open(anime_path, "rb").read())
    if not animations or not animations[0].is_used:
        raise fe_assets.AssetError(f"no idle animation in {anime_path}")
    return animations[0].frames[0]


def load_display(path: str, lz13) -> Image.Image:
    texture = fe_assets.bch_textures(lz13.decompress(open(path, "rb").read()))[0]
    return Image.frombytes("RGBA", (texture.width, texture.height), texture.rgba).rotate(
        90, expand=True
    )


def class_folder(jid: str) -> str:
    return jid[4:] if jid.startswith("JID_") else jid


def class_folder_candidates(jid: str) -> list[str]:
    folder = class_folder(jid)
    candidates = [folder]
    if folder.endswith(("男", "女")):
        candidates.append(folder[:-1])
    return candidates


def find_body(romfs: str, jid: str):
    """Locate the 青0 body sheet + anime.bin for a class job id."""
    for candidate in class_folder_candidates(jid):
        directory = os.path.join(romfs, "unit", "Body", candidate)
        sheet = os.path.join(directory, HEAD_FILE)
        anime = os.path.join(directory, "anime.bin")
        if os.path.isfile(sheet) and os.path.isfile(anime):
            source = f"unit/Body/{candidate}/{HEAD_FILE} + anime.bin"
            return sheet, anime, source, False
    prefix = class_folder(jid) + "_"
    unique_root = os.path.join(romfs, "unit", "Unique")
    if os.path.isdir(unique_root):
        for folder in sorted(os.listdir(unique_root)):
            if not folder.startswith(prefix) or "_変_" in folder:
                continue
            directory = os.path.join(unique_root, folder)
            sheet = os.path.join(directory, HEAD_FILE)
            anime = os.path.join(directory, "anime.bin")
            if os.path.isfile(sheet) and os.path.isfile(anime):
                source = f"unit/Unique/{folder}/{HEAD_FILE} + anime.bin"
                return sheet, anime, source, True
    return None, None, None, None


def unit_head_folder(unit: dict) -> str | None:
    fid = unit.get("fid") or ""
    if fid.startswith("FID_"):
        return fid[4:]
    if unit.get("isCorrin"):
        return AVATAR_HEAD_FOLDER[unit["gender"]]
    return None


def unit_name(unit: dict) -> str:
    fid = unit.get("fid") or ""
    return fid[4:] if fid.startswith("FID_") else ""


def unit_unique_folder(romfs: str, unit: dict, jid: str) -> str | None:
    name = unit_name(unit)
    if not name:
        return None
    folder = f"{class_folder(jid)}_{name}"
    directory = os.path.join(romfs, "unit", "Unique", folder)
    if os.path.isfile(os.path.join(directory, HEAD_FILE)) and os.path.isfile(
        os.path.join(directory, "anime.bin")
    ):
        return folder
    return None


def head_entry(file_name: str, source: str, width: int, height: int) -> dict:
    return {"file": file_name, "w": width, "h": height, "source": source}


def extract_bodies(romfs: str, out_dir: str, classes: list[dict], lz13):
    entries = {}
    missing = []
    for class_def in classes:
        sheet, anime, source, is_unique = find_body(romfs, class_def["jid"])
        if not sheet:
            missing.append((class_def["id"], class_def["name"], class_def["jid"]))
            continue
        frame = idle_frame(anime)
        body = load_display(sheet, lz13).crop(
            (frame.body_src_x, frame.body_src_y, frame.body_src_x + frame.body_w, frame.body_src_y + frame.body_h)
        )
        file_name = f"assets/sprites/bodies/{class_def['id']}.webp"
        write_webp(body, os.path.join(os.path.dirname(out_dir), *file_name.split("/")))
        head = None
        if not is_unique and frame.head_w and frame.head_h:
            head = {
                "x": frame.head_x - frame.body_x,
                "y": frame.head_y - frame.body_y,
                "behind": False,
            }
            if frame.head_w == 16 and frame.head_h == 16:
                head["variant"] = "small"
        entries[str(class_def["id"])] = {
            "file": file_name,
            "w": body.width,
            "h": body.height,
            "head": head,
            "source": source,
        }
    return entries, missing


def export_head_variants(image: Image.Image, out_dir: str, prefix: str, source: str) -> dict | None:
    """Export the large 32x32 and small 16x16 idle head cells for `prefix`.

    `prefix` is site-relative (e.g. "assets/sprites/heads/25"); either cell may
    be absent on class-generic sheets, in which case only the other is written.
    """
    dest = os.path.join(os.path.dirname(out_dir), *prefix.split("/"))
    entry = None
    large = image.crop((0, 0, 32, 32))
    small = image.crop((0, 32, 16, 48))
    if large.getbbox() is not None:
        write_webp(large, f"{dest}.webp")
        entry = head_entry(f"{prefix}.webp", source, 32, 32)
    if small.getbbox() is not None:
        write_webp(small, f"{dest}-small.webp")
        small_entry = head_entry(f"{prefix}-small.webp", source + " (small)", 16, 16)
        if entry is None:
            entry = small_entry
        else:
            entry["small"] = small_entry
    return entry


def extract_heads(romfs: str, out_dir: str, units: list[dict], lz13):
    entries = {}
    missing = []
    for unit in units:
        folder = unit_head_folder(unit)
        sheet = os.path.join(romfs, "unit", "Head", folder or "", HEAD_FILE)
        if not folder or not os.path.isfile(sheet):
            missing.append((unit["id"], unit["name"], folder))
            continue
        image = load_display(sheet, lz13)
        prefix = f"assets/sprites/heads/{unit['slot']}"
        source = f"unit/Head/{folder}/{HEAD_FILE}"
        entry = export_head_variants(image, out_dir, prefix, source)
        if entry is None:
            missing.append((unit["id"], unit["name"], folder))
            continue
        entries[unit["id"]] = entry
    return entries, missing


def extract_generic_heads(romfs: str, out_dir: str, classes: list[dict], lz13):
    entries = {}
    missing = []
    for class_def in classes:
        folder = None
        for candidate in class_folder_candidates(class_def["jid"]):
            if os.path.isfile(os.path.join(romfs, "unit", "Head", candidate, HEAD_FILE)):
                folder = candidate
                break
        if not folder:
            missing.append((class_def["id"], class_def["name"]))
            continue
        image = load_display(
            os.path.join(romfs, "unit", "Head", folder, HEAD_FILE), lz13
        )
        prefix = f"assets/sprites/generic-heads/{class_def['id']}"
        source = f"unit/Head/{folder}/{HEAD_FILE}"
        entry = export_head_variants(image, out_dir, prefix, source)
        if entry is not None:
            entries[str(class_def["id"])] = entry
        else:
            missing.append((class_def["id"], class_def["name"]))
    return entries, missing


def extract_unique(romfs: str, out_dir: str, units: list[dict], classes: list[dict], lz13):
    entries = {}
    for unit in units:
        per_class = {}
        for class_def in classes:
            folder = unit_unique_folder(romfs, unit, class_def["jid"])
            if not folder:
                continue
            directory = os.path.join(romfs, "unit", "Unique", folder)
            frame = idle_frame(os.path.join(directory, "anime.bin"))
            body = load_display(os.path.join(directory, HEAD_FILE), lz13).crop(
                (
                    frame.body_src_x,
                    frame.body_src_y,
                    frame.body_src_x + frame.body_w,
                    frame.body_src_y + frame.body_h,
                )
            )
            file_name = f"assets/sprites/unique/{unit['slot']}-{class_def['id']}.webp"
            write_webp(body, os.path.join(os.path.dirname(out_dir), *file_name.split("/")))
            source = f"unit/Unique/{folder}/{HEAD_FILE} + anime.bin"
            per_class[str(class_def["id"])] = {
                "file": file_name,
                "w": body.width,
                "h": body.height,
                "source": source,
            }
        if per_class:
            entries[unit["id"]] = per_class
    return entries


def image_for(out_dir: str, file_name: str) -> Image.Image:
    return Image.open(os.path.join(os.path.dirname(out_dir), *file_name.split("/"))).convert("RGBA")


def compose_contract(out_dir: str, body_entry: dict, head_entry: dict | None) -> Image.Image:
    body = image_for(out_dir, body_entry["file"])
    head = None
    if head_entry is not None:
        head = image_for(out_dir, head_entry["file"])
    left = 0
    top = 0
    if head_entry is not None:
        left = min(0, body_entry["head"]["x"])
        top = min(0, body_entry["head"]["y"])
    width = body.width + abs(left)
    height = body.height + abs(top)
    if head is not None:
        width = max(width, body_entry["head"]["x"] - left + head.width)
        height = max(height, body_entry["head"]["y"] - top + head.height)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    if head is None:
        canvas.alpha_composite(body, (-left, -top))
        return canvas
    paste = (body_entry["head"]["x"] - left, body_entry["head"]["y"] - top)
    if body_entry["head"].get("behind"):
        canvas.alpha_composite(head, paste)
        canvas.alpha_composite(body, (-left, -top))
    else:
        canvas.alpha_composite(body, (-left, -top))
        canvas.alpha_composite(head, paste)
    return canvas


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def build_contact_sheet(
    out_dir: str,
    sheet_path: str,
    bodies: dict,
    heads: dict,
    unique: dict,
    classes: list[dict],
    units: list[dict],
) -> None:
    class_by_name = {c["name"]: c for c in classes}
    unit_by_name = {u["name"]: u for u in units}
    scale = 4
    tiles = []
    for label, class_name, unit_name in CONTACT_SHEET:
        class_id = class_by_name[class_name]["id"]
        unit = unit_by_name[unit_name]
        body_entry = bodies[str(class_id)]
        unique_entry = unique.get(unit["id"], {}).get(str(class_id))
        if unique_entry:
            tile = compose_contract(out_dir, unique_entry, None)
        else:
            head = heads[unit["id"]]
            if body_entry["head"] and body_entry["head"].get("variant") == "small":
                head = head.get("small") or head
            tile = compose_contract(out_dir, body_entry, head)
        tiles.append((label, tile))
    pad = 12
    label_h = 26
    font = load_font(18)
    label_w = max(int(font.getlength(label)) for label, _ in tiles)
    cell_w = max(max(tile.width for _, tile in tiles) * scale, label_w) + pad * 2
    cell_h = max(tile.height for _, tile in tiles) * scale + pad * 2 + label_h
    columns = 4
    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_w, rows * cell_h), (36, 36, 50, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (label, tile) in enumerate(tiles):
        column = index % columns
        row = index // columns
        x = column * cell_w
        y = row * cell_h
        draw.text((x + pad, y + 4), label, font=font, fill=(255, 255, 255, 255))
        big = tile.resize((tile.width * scale, tile.height * scale), Image.NEAREST)
        sheet.alpha_composite(big, (x + pad, y + label_h + pad))
    os.makedirs(os.path.dirname(sheet_path), exist_ok=True)
    sheet.convert("RGB").save(sheet_path, "PNG")
    print(f"contact sheet: {os.path.relpath(sheet_path, REPO_ROOT)} ({sheet.width}x{sheet.height})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--romfs", default=DEFAULT_ROMFS)
    parser.add_argument("--fe-tools", default=DEFAULT_FE_TOOLS)
    parser.add_argument("--pack", default=DEFAULT_PACK)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--sheet", default=DEFAULT_SHEET)
    args = parser.parse_args()

    lz13 = load_lz13(args.fe_tools)
    units = read_json(os.path.join(args.pack, "units.json"))["units"]
    classes = read_json(os.path.join(args.pack, "classes.json"))["classes"]

    bodies, body_missing = extract_bodies(args.romfs, args.out, classes, lz13)
    heads, head_missing = extract_heads(args.romfs, args.out, units, lz13)
    generic_heads, generic_missing = extract_generic_heads(args.romfs, args.out, classes, lz13)
    unique = extract_unique(args.romfs, args.out, units, classes, lz13)

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Owner's romfs dump (work/cia-extract/romfs) via tools/assets/extract_sprites.py",
        "coverage": {
            "bodies": {"resolved": len(bodies), "total": len(classes)},
            "heads": {"resolved": len(heads), "total": len(units)},
        },
        "bodies": bodies,
        "heads": heads,
        "genericHeads": generic_heads,
        "unique": unique,
    }
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)
    with open(args.manifest, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    build_contact_sheet(args.out, args.sheet, bodies, heads, unique, classes, units)

    def report(label: str, resolved: int, total: int) -> None:
        print(f"{label}: {resolved}/{total} ({100 * resolved / max(total, 1):.1f}%)")

    report("bodies", len(bodies), len(classes))
    report("heads", len(heads), len(units))
    report("genericHeads", len(generic_heads), len(classes))
    print(f"unique pairs: {sum(len(v) for v in unique.values())}")
    for entry in body_missing:
        print(f"  missing body: {entry}")
    for entry in head_missing:
        print(f"  missing head: {entry}")
    for entry in generic_missing:
        print(f"  missing generic head: {entry}")
    print(f"manifest: {os.path.relpath(args.manifest, REPO_ROOT)}")


if __name__ == "__main__":
    main()
