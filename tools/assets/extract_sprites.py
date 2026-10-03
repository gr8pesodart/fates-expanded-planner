#!/usr/bin/env python3
"""Stitch FE Fates map sprites (class body + unit head) from the owner's dump.

FE Fates composes map sprites from two textures: the class body sheet
(`unit/Body/<class>/青0.bch.lz`) and the character head sheet
(`unit/Head/<character>/青0.bch.lz`), positioned by the class animation script
(`unit/Body/<class>/anime.bin`). Some class+character pairs have a full-body
override under `unit/Unique/<class>_<character>/` (Velouria's wolf forms,
Kana's nobles, Azura's Songstress dress, monsters).

The animation script's record layout is documented in docs/assets/anime-bin.md.
The idle/standing clip is animation 0: four unique body/head cells plus a timed
sequence and per-pose head offsets. Head sheets carry four poses for each of
two sizes: the "large" 32x32 cells used by foot classes and the separately drawn
"small" 16x16 cells used by mounted classes.

The texture alpha is not opacity: on heads it marks the layer behind the body
(0x66, 0xEE hair) and the layer in front (0x88, 0xFF hair); 0xEE/0xFF are the
recolourable-hair mask (see HEAD_BANDS and docs/assets/anime-bin.md). Bodies
ship as one opaque image (`layers: 1`), heads as a 2-cell [back | front] strip,
drawn head-back, body, head-front; hair is tinted with the FaceData default. The single
flattened opaque image is used for Unique bodies (no head) and the `unique` set.

Outputs (paths relative to the site base, mirrored under --out):

  - `assets/sprites/bodies/<classId>.webp`          four idle body poses (or flat poses when unique)
  - `assets/sprites/heads/<slot>.webp`              unit large head poses
  - `assets/sprites/heads/<slot>-small.webp`        unit small head poses
  - `assets/sprites/generic-heads/<classId>.webp`   class-generic head poses
  - `assets/sprites/unique/<slot>-<classId>.webp`   unit+class idle pose strip
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

import extract_portraits  # noqa: E402  (shared FaceData parser + hair tint)
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

# Female Corrin uses body build 2 (owner, 2026-10-04: "Female Build 2" in Serenes Forest's Kamui
# customizer); extract_portraits.py › AVATAR_FALLBACK_FSID matches.
AVATAR_HEAD_FOLDER = {
    "male": "プレイヤー男1_01",
    "female": "プレイヤー女2_01",
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


# Head texture alpha splits the head into the layer behind the body and the layer in front of it:
# 0x66 (plus 0xEE, recolourable long hair) is back hair, 0x88 (plus 0xFF, recolourable front hair)
# is the face and front hair. The body draws whole between them. Verified on long-haired infantry
# (Charlotte, Izana, Nyx, Corrin (F)) whose 0x66 hair must fall behind their 0x66 bodies, and on
# mounted riders whose 0x88 faces stay in front of the mount.
BODY_BANDS = (frozenset({0x66, 0x88, 0xEE, 0xFF}),)
HEAD_BANDS = (frozenset({0x66, 0xEE}), frozenset({0x88, 0xFF}))


def layer_strip(image: Image.Image, bands: tuple[frozenset[int], ...]) -> Image.Image:
    """One opaque cell per band (back to front), laid out left to right."""
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    used = {value for value in range(1, 256) if histogram[value]}
    unknown = used - set().union(*bands)
    if unknown:
        raise fe_assets.AssetError(f"unexpected draw priorities {sorted(hex(v) for v in unknown)}")
    rgb = image.convert("RGB").convert("RGBA")
    strip = Image.new("RGBA", (image.width * len(bands), image.height), (0, 0, 0, 0))
    for index, band in enumerate(bands):
        cell = rgb.copy()
        cell.putalpha(alpha.point(lambda value, band=band: 255 if value in band else 0))
        strip.paste(cell, (index * image.width, 0))
    return strip


def flatten(image: Image.Image) -> Image.Image:
    """Single opaque image: every pixel with priority > 0 becomes fully opaque."""
    mask = image.getchannel("A").point(lambda value: 255 if value else 0)
    flat = image.convert("RGB").convert("RGBA")
    flat.putalpha(mask)
    return flat


def assert_binary_alpha(image: Image.Image, label: str) -> None:
    histogram = image.getchannel("A").histogram()
    levels = [value for value in range(256) if value not in (0, 255) and histogram[value]]
    if levels:
        raise fe_assets.AssetError(f"{label} has non-binary alpha: {levels}")


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


def idle_animation(anime_path: str) -> Animation:
    animations = parse_animations(open(anime_path, "rb").read())
    if not animations or not animations[0].is_used:
        raise fe_assets.AssetError(f"no idle animation in {anime_path}")
    animation = animations[0]
    if animation.frame_count < 1:
        raise fe_assets.AssetError(f"idle animation has no frames in {anime_path}")
    return animation


def unique_idle_frames(animation: Animation, label: str) -> dict[int, Frame]:
    frames = {}
    for frame in animation.frames[: animation.frame_count]:
        frames.setdefault(frame.frame_index, frame)
    if sorted(frames) != [0, 1, 2, 3]:
        raise fe_assets.AssetError(f"{label} idle cells are not the expected 0–3: {sorted(frames)}")
    return frames


def animation_contract(animation: Animation) -> list[dict]:
    contract = []
    for frame in animation.frames[: animation.frame_count]:
        if frame.body_x or frame.body_y:
            raise fe_assets.AssetError("idle body draw offsets are not supported")
        head = None
        head_cell = None
        if frame.head_w and frame.head_h:
            if frame.head_src_y != (32 if frame.head_w == 16 else 0) or frame.head_src_x != frame.frame_index * frame.head_w:
                raise fe_assets.AssetError("idle head source does not map to its frame index")
            head_cell = frame.frame_index
            head = {"x": frame.head_x - frame.body_x, "y": frame.head_y - frame.body_y}
            if frame.head_w == 16:
                head["variant"] = "small"
        contract.append({"cell": frame.frame_index, "headCell": head_cell, "delay": frame.frame_delay, "head": head})
    return contract


def compact_animation(contract: list[dict], head: dict | None) -> list[list[int]]:
    """Manifest form: [cell, delay] or [cell, delay, headX, headY] when the head leaves its rest offset.

    Ships in the main bundle, so redundancy is stripped: the head cell always equals the body cell
    (animation_contract enforces it), and head presence and size variant are fixed per body.
    """
    frames = []
    for frame in contract:
        if (frame["head"] is None) != (head is None):
            raise fe_assets.AssetError("idle head appears or vanishes mid-animation")
        entry = [frame["cell"], frame["delay"]]
        if head is not None:
            if frame["head"].get("variant") != head.get("variant"):
                raise fe_assets.AssetError("idle head changes size mid-animation")
            if (frame["head"]["x"], frame["head"]["y"]) != (head["x"], head["y"]):
                entry += [frame["head"]["x"], frame["head"]["y"]]
        frames.append(entry)
    return frames


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
    return {"file": file_name, "w": width, "h": height, "layers": len(HEAD_BANDS), "frameCount": 4, "source": source}


def extract_bodies(romfs: str, out_dir: str, classes: list[dict], lz13):
    entries = {}
    missing = []
    for class_def in classes:
        sheet, anime, source, is_unique = find_body(romfs, class_def["jid"])
        if not sheet:
            missing.append((class_def["id"], class_def["name"], class_def["jid"]))
            continue
        animation = idle_animation(anime)
        idle_frames = unique_idle_frames(animation, f"class {class_def['id']}")
        body_sheet = load_display(sheet, lz13)
        cells = [None] * 4
        for index, frame in idle_frames.items():
            if frame.body_w != 32 or frame.body_h != 32 or frame.body_src_y != 0 or frame.body_src_x != index * 32:
                raise fe_assets.AssetError(f"class {class_def['id']} idle body cell {index} is unexpected")
            cells[index] = body_sheet.crop((frame.body_src_x, frame.body_src_y, frame.body_src_x + frame.body_w, frame.body_src_y + frame.body_h))
        body = cells[0]
        animation_data = animation_contract(animation)
        file_name = f"assets/sprites/bodies/{class_def['id']}.webp"
        path = os.path.join(os.path.dirname(out_dir), *file_name.split("/"))
        head = None
        if not is_unique and animation_data[0]["head"]:
            head = dict(animation_data[0]["head"])
            image = Image.new("RGBA", (body.width * len(BODY_BANDS) * 4, body.height), (0, 0, 0, 0))
            for index, cell in enumerate(cells):
                image.alpha_composite(layer_strip(cell, BODY_BANDS), (index * body.width * len(BODY_BANDS), 0))
        else:
            image = Image.new("RGBA", (body.width * 4, body.height), (0, 0, 0, 0))
            for index, cell in enumerate(cells):
                image.alpha_composite(flatten(cell), (index * body.width, 0))
        assert_binary_alpha(image, f"body {class_def['id']}")
        write_webp(image, path)
        entry = {
            "file": file_name,
            "w": body.width,
            "h": body.height,
            "head": head,
            "source": source,
            "frameCount": 4,
            "animation": compact_animation(animation_data, head),
        }
        if head is not None:
            entry["layers"] = len(BODY_BANDS)
        entries[str(class_def["id"])] = entry
    return entries, missing


def export_head_variants(image: Image.Image, out_dir: str, prefix: str, source: str, hair: Image.Image | None = None) -> dict | None:
    """Export the large and small four-pose idle head strips for `prefix`.

    `prefix` is site-relative (e.g. "assets/sprites/heads/25"); either cell may
    be absent on class-generic sheets, in which case only the other is written.
    Each cell ships as a two-layer priority strip. With `hair` (the untinted
    sheet), recolourable hair also ships as a same-layout `-hair` strip holding
    only the grey 0xEE/0xFF pixels, which the app tints per run (art.tsx).
    """
    dest = os.path.join(os.path.dirname(out_dir), *prefix.split("/"))
    entry = None
    def head_strip(source_image: Image.Image, width: int, y: int) -> Image.Image:
        strip = Image.new("RGBA", (width * len(HEAD_BANDS) * 4, width), (0, 0, 0, 0))
        for frame in range(4):
            cell = source_image.crop((frame * width, y, (frame + 1) * width, y + width))
            strip.alpha_composite(layer_strip(cell, HEAD_BANDS), (frame * width * len(HEAD_BANDS), 0))
        return strip

    hair_only = hair_pixels(hair) if hair is not None else None

    def export(width: int, y: int, suffix: str, label: str) -> dict | None:
        strip = head_strip(image, width, y)
        if strip.getbbox() is None:
            return None
        assert_binary_alpha(strip, f"{prefix}{suffix}")
        write_webp(strip, f"{dest}{suffix}.webp")
        result = head_entry(f"{prefix}{suffix}.webp", source + label, width, width)
        if hair_only is not None:
            mask = head_strip(hair_only, width, y)
            if mask.getbbox() is not None:
                assert_binary_alpha(mask, f"{prefix}{suffix}-hair")
                write_webp(mask, f"{dest}{suffix}-hair.webp")
                result["hair"] = f"{prefix}{suffix}-hair.webp"
        return result

    large = export(32, 0, "", "")
    small = export(16, 32, "-small", " (small)")
    if large is not None:
        entry = large
        if small is not None:
            entry["small"] = small
    elif small is not None:
        entry = small
    return entry


HAIR_MASK = frozenset({0xEE, 0xFF})


def hair_pixels(image: Image.Image) -> Image.Image:
    """Only the recolourable-hair pixels (alpha 0xEE / 0xFF kept, everything else cleared), untinted."""
    alpha = image.getchannel("A").point(lambda value: value if value in HAIR_MASK else 0)
    result = image.copy()
    result.putalpha(alpha)
    return result


# The mask grey that shows exactly the FaceData colour: the ramps run 0x44-0xBB plus a few 0xEE
# specular pixels, and hand-drawn first-gen sprite hair sits at 0.46-1.1x its FaceData colour's
# lightness (Camilla, Azura, Jakob, Elise, Leo...) - the colour is the main lit tone, not the mid.
HAIR_REFERENCE_GREY = 0xBB


def tint_ramp(image: Image.Image, color: bytes) -> Image.Image:
    """Map-sprite hair tint: out = min(255, grey * colour / 0xBB) per channel.

    Overlay (as on portraits) washed greys above 0x80 out towards white; a x2 modulate clipped light
    colours (Camilla, Jakob, Soleil) to pure white. Scaling the ramp so its main lit tone equals the
    colour matches the artists' own sprites. The game's combiner itself is not verified. Mirrored
    in src/components/art.tsx > tintTables.
    """
    lut = []
    for channel in range(3):
        base = color[channel]
        lut.extend(min(255, (value * base) // HAIR_REFERENCE_GREY) for value in range(256))
    rgb = image.convert("RGB").point(lut)
    result = rgb.convert("RGBA")
    result.putalpha(image.getchannel("A"))
    return result


def tint_hair(image: Image.Image, color: bytes | None) -> Image.Image:
    """Recolourable hair is stored grey (the game tints it at runtime); apply the FaceData colour."""
    if not color:
        return image
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value in HAIR_MASK else 0)
    if mask.getbbox() is None:
        return image
    tinted = tint_ramp(image, color)
    result = image.copy()
    result.paste(tinted.convert("RGB"), mask=mask)
    result.putalpha(alpha)
    return result


def hair_colours(romfs: str, units: list[dict], lz13) -> dict[str, bytes]:
    """Default hair colour per unit from FaceData (same records the talk portraits use)."""
    faces = extract_portraits.parse_face_data(romfs, lz13)
    colours = {}
    for unit in units:
        fid = unit.get("fid") or ""
        info = faces.get(f"FSID_ST_{fid[4:]}") if fid.startswith("FID_") else None
        if not info and unit.get("isCorrin"):
            info = faces.get(extract_portraits.AVATAR_FALLBACK_FSID[unit["gender"]])
        if info:
            colours[unit["id"]] = info["hair_color"]
    return colours


def corrin_hair_swatches(romfs: str, lz13) -> list[str]:
    """Corrin's creation-screen hair colours: GameData/MyUnitEdit.bin.lz, the BinArchive table
    labelled カラーテーブル ("colour table") — u32 label ptr, u16 count, u16 entry size, u32 data ptr;
    entries are RGBA8888. Paragon's FE14 HairColorMenu module reads the same table."""
    path = os.path.join(romfs, "GameData", "MyUnitEdit.bin.lz")
    with open(path, "rb") as f:
        data = lz13.decompress(f.read())
    # Find the descriptor: a pointer to the label, followed by a 30 x 4-byte header. Both the label
    # text and its pointer recur elsewhere in the archive, so check every pairing.
    text = "カラーテーブル".encode("shift_jis")
    found = None
    label = data.find(text)
    while label >= 0 and found is None:
        needle = struct.pack("<I", label - 0x20)
        position = data.find(needle)
        while position >= 0:
            count, size, pointer = struct.unpack_from("<HHI", data, position + 4)
            if count == 30 and size == 4:
                found = (count, size, pointer)
                break
            position = data.find(needle, position + 1)
        label = data.find(text, label + 1)
    if found is None:
        fail("MyUnitEdit.bin: colour table descriptor not found")
    count, size, pointer = found
    base = pointer + 0x20
    return ["#" + data[base + i * size : base + i * size + 3].hex() for i in range(count)]


def extract_heads(romfs: str, out_dir: str, units: list[dict], lz13):
    entries = {}
    missing = []
    colours = hair_colours(romfs, units, lz13)
    for unit in units:
        folder = unit_head_folder(unit)
        sheet = os.path.join(romfs, "unit", "Head", folder or "", HEAD_FILE)
        if not folder or not os.path.isfile(sheet):
            missing.append((unit["id"], unit["name"], folder))
            continue
        raw = load_display(sheet, lz13)
        image = tint_hair(raw, colours.get(unit["id"]))
        prefix = f"assets/sprites/heads/{unit['slot']}"
        source = f"unit/Head/{folder}/{HEAD_FILE}"
        entry = export_head_variants(image, out_dir, prefix, source, hair=raw)
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
    colours = hair_colours(romfs, units, lz13)
    for unit in units:
        per_class = {}
        for class_def in classes:
            folder = unit_unique_folder(romfs, unit, class_def["jid"])
            if not folder:
                continue
            directory = os.path.join(romfs, "unit", "Unique", folder)
            animation = idle_animation(os.path.join(directory, "anime.bin"))
            idle_frames = unique_idle_frames(animation, f"unique {unit['slot']}-{class_def['id']}")
            raw_sheet = load_display(os.path.join(directory, HEAD_FILE), lz13)
            body_sheet = tint_hair(raw_sheet, colours.get(unit["id"]))
            hair_sheet = hair_pixels(raw_sheet)
            image = Image.new("RGBA", (32 * 4, 32), (0, 0, 0, 0))
            hair = Image.new("RGBA", (32 * 4, 32), (0, 0, 0, 0))
            for index, frame in idle_frames.items():
                if frame.body_w != 32 or frame.body_h != 32 or frame.body_src_y != 0 or frame.body_src_x != index * 32:
                    raise fe_assets.AssetError("unique idle body cell is unexpected")
                box = (frame.body_src_x, frame.body_src_y, frame.body_src_x + frame.body_w, frame.body_src_y + frame.body_h)
                image.alpha_composite(flatten(body_sheet.crop(box)), (index * 32, 0))
                hair.alpha_composite(flatten(hair_sheet.crop(box)), (index * 32, 0))
            label = f"unique {unit['slot']}-{class_def['id']}"
            assert_binary_alpha(image, label)
            file_name = f"assets/sprites/unique/{unit['slot']}-{class_def['id']}.webp"
            write_webp(image, os.path.join(os.path.dirname(out_dir), *file_name.split("/")))
            source = f"unit/Unique/{folder}/{HEAD_FILE} + anime.bin"
            animation_data = animation_contract(animation)
            per_class[str(class_def["id"])] = {
                "file": file_name,
                "w": image.width // 4,
                "h": image.height,
                "frameCount": 4,
                "animation": compact_animation(animation_data, None),
                "source": source,
            }
            if hair.getbbox() is not None:
                assert_binary_alpha(hair, f"{label} hair")
                hair_file = f"assets/sprites/unique/{unit['slot']}-{class_def['id']}-hair.webp"
                write_webp(hair, os.path.join(os.path.dirname(out_dir), *hair_file.split("/")))
                per_class[str(class_def["id"])]["hair"] = hair_file
        if per_class:
            entries[unit["id"]] = per_class
    return entries


def image_for(out_dir: str, file_name: str) -> Image.Image:
    return Image.open(os.path.join(os.path.dirname(out_dir), *file_name.split("/"))).convert("RGBA")


def layer_cell(image: Image.Image, entry: dict, index: int, frame: int = 0) -> Image.Image:
    layers = entry.get("layers", 1)
    offset = (frame * layers + index) * entry["w"]
    return image.crop((offset, 0, offset + entry["w"], entry["h"]))


def compose_contract(out_dir: str, body_entry: dict, head_entry: dict | None) -> Image.Image:
    """Composite back to front: head back layer, body, head front layer.

    Flattened bodies (Unique, no head) are already a single opaque image and pass through.
    """
    body_image = image_for(out_dir, body_entry["file"])
    if not body_entry.get("layers") or head_entry is None:
        return layer_cell(body_image, body_entry, 0)
    head_image = image_for(out_dir, head_entry["file"])
    head_position = body_entry["head"]
    head_cell = 0
    offset_x = head_position["x"]
    offset_y = head_position["y"]
    left = min(0, offset_x)
    top = min(0, offset_y)
    width = max(body_entry["w"], offset_x + head_entry["w"]) - left
    height = max(body_entry["h"], offset_y + head_entry["h"]) - top
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    paste_body = (-left, -top)
    paste_head = (offset_x - left, offset_y - top)
    for image, entry, index, at, frame_index in (
        (head_image, head_entry, 0, paste_head, head_cell),
        (body_image, body_entry, 0, paste_body, 0),
        (head_image, head_entry, 1, paste_head, head_cell),
    ):
        canvas.alpha_composite(layer_cell(image, entry, index, frame_index), at)
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
        # FaceData default hair per unit: what a child inherits from this unit as variable parent.
        "hairColours": {unit_id: "#" + colour[:3].hex() for unit_id, colour in hair_colours(args.romfs, units, lz13).items()},
        # Corrin's 30 creation swatches, in menu order (the first, white, is the default).
        "corrinHairColours": corrin_hair_swatches(args.romfs, lz13),
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
