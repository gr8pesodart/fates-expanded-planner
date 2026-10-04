#!/usr/bin/env python3
"""Extract class sprites, skill icons and unit face icons from the owner's dump.

Everything is read from the owner's own romfs dump
(`../3ds-games/fe-fates/work/cia-extract/romfs/`, see docs/ASSETS.md) and
converted to optimised WebP files under `public/assets/`:

  - skills:  `icon/Icon.bch.lz` textures "skill" + "skill2", sliced 24x24 in
             skill-icon index order (the Skill table's `icon` field).
  - classes: `unit/Body/<job>/青0.bch.lz` (player-coloured map sprite sheet),
             rotated 90° and cropped to one frame per class.
  - units:   `face/face/<portrait>_bu.arc` face part ("通常" emotion), merged
             with the character's hair (`face/hair/<hair>/髪0.bch.lz`, tinted
             with the hair colour from FaceData) and cropped to the BU face
             rectangle from `face/FaceData.bin.lz`.

The script writes `src/data/assets.json` (game id -> file + source per entry)
and prints a coverage report. Run it from the repo root:

    python tools/assets/extract_assets.py

The BCH/LZ13/pixel decoders live in tools/assets/fe_assets.py; Pillow is the
only third-party dependency.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
from datetime import datetime, timezone

from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO_ROOT, "tools", "assets"))

import fe_assets  # noqa: E402

DEFAULT_ROMFS = os.path.join(
    REPO_ROOT, "..", "3ds-games", "fe-fates", "work", "cia-extract", "romfs"
)
DEFAULT_FE_TOOLS = os.path.join(REPO_ROOT, "..", "3ds-games", "fe-fates", "tools")
DEFAULT_PACK = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")
DEFAULT_OUT = os.path.join(REPO_ROOT, "public", "assets")
DEFAULT_MANIFEST = os.path.join(REPO_ROOT, "src", "data", "assets.json")

SKILL_ICON_CELL = 24
FACE_BODY_SIZE = 128
FRAME_FALLBACK_TEAMS = ("青0.bch.lz", "緑0.bch.lz", "赤0.bch.lz", "紫0.bch.lz", "青1.bch.lz")

# The avatar's fid is player-configured; FaceData ships a default face per gender.
AVATAR_FALLBACK_FSID = {
    "male": "FSID_BU_マイユニ_男1_顔A",
    "female": "FSID_BU_マイユニ_女2_顔A",  # body build 2 (owner, 2026-10-04), as extract_portraits.py
}


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


def write_webp(image: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "WEBP", lossless=True, quality=100, method=6)


# ----------------------------- skill icons ---------------------------------


def extract_skill_icons(romfs: str, out_dir: str, skills: list[dict], lz13):
    icon_path = os.path.join(romfs, "icon", "Icon.bch.lz")
    if not os.path.isfile(icon_path):
        fail(f"missing {icon_path}")
    textures = {t.name: t for t in fe_assets.bch_textures(lz13.decompress(open(icon_path, "rb").read()))}
    sheets = []
    for name in ("skill", "skill2"):
        if name not in textures:
            fail(f"Icon.bch.lz has no '{name}' texture")
        sheets.append((name, textures[name]))

    cells: list[tuple[str, int, int, Image.Image]] = []
    for name, sheet in sheets:
        image = Image.frombytes("RGBA", (sheet.width, sheet.height), sheet.rgba)
        columns = sheet.width // SKILL_ICON_CELL
        rows = sheet.height // SKILL_ICON_CELL
        for row in range(rows):
            for column in range(columns):
                box = (
                    column * SKILL_ICON_CELL,
                    row * SKILL_ICON_CELL,
                    (column + 1) * SKILL_ICON_CELL,
                    (row + 1) * SKILL_ICON_CELL,
                )
                cells.append((name, column, row, image.crop(box)))

    entries = {}
    missing = []
    for skill in skills:
        index = skill.get("icon")
        if index is None or not (0 <= index < len(cells)):
            missing.append((skill["id"], skill["name"], index))
            continue
        sheet_name, column, row, icon = cells[index]
        file_name = f"assets/skills/{skill['id']}.webp"
        write_webp(icon, os.path.join(os.path.dirname(out_dir), *file_name.split("/")))
        entries[str(skill["id"])] = {
            "file": file_name,
            "source": f"icon/Icon.bch.lz#{sheet_name}[{column},{row}] (icon {index})",
        }
    return entries, missing, len(cells)


# ---------------------------- class sprites --------------------------------


def find_class_sheet(romfs: str, jid: str):
    """Locate the player-coloured body sheet for a class job id."""
    folder = jid[4:] if jid.startswith("JID_") else jid
    candidates = [folder]
    if folder.endswith(("男", "女")):
        candidates.append(folder[:-1])
    body_root = os.path.join(romfs, "unit", "Body")
    for candidate in candidates:
        directory = os.path.join(body_root, candidate)
        if not os.path.isdir(directory):
            continue
        for team in FRAME_FALLBACK_TEAMS:
            path = os.path.join(directory, team)
            if os.path.isfile(path):
                return path, os.path.join("unit", "Body", candidate, team).replace(os.sep, "/")
    # Last resort: a unique character sprite using this job (e.g. Songstress).
    unique_root = os.path.join(romfs, "unit", "Unique")
    if os.path.isdir(unique_root):
        for unique in sorted(os.listdir(unique_root)):
            if unique.startswith(folder + "_"):
                directory = os.path.join(unique_root, unique)
                for team in FRAME_FALLBACK_TEAMS:
                    path = os.path.join(directory, team)
                    if os.path.isfile(path):
                        return path, os.path.join("unit", "Unique", unique, team).replace(os.sep, "/")
    return None, None


def extract_class_sprites(romfs: str, out_dir: str, classes: list[dict], lz13):
    entries = {}
    missing = []
    for class_def in classes:
        jid = class_def.get("jid") or ""
        path, source = find_class_sheet(romfs, jid)
        if not path:
            missing.append((class_def["id"], class_def["name"], jid))
            continue
        texture = fe_assets.bch_textures(lz13.decompress(open(path, "rb").read()))[0]
        image = Image.frombytes("RGBA", (texture.width, texture.height), texture.rgba)
        image = image.rotate(90, expand=True)
        side = min(image.width, image.height)
        frame = image.crop((0, 0, side, side))
        scale = max(1, FACE_BODY_SIZE // side)
        frame = frame.resize((side * scale, side * scale), Image.NEAREST)
        file_name = f"assets/classes/{class_def['id']}.webp"
        write_webp(frame, os.path.join(os.path.dirname(out_dir), *file_name.split("/")))
        entries[str(class_def["id"])] = {"file": file_name, "source": source}
    return entries, missing


# ------------------------------ unit faces ---------------------------------


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
            "bu": struct.unpack_from("<HHHH", record, 48),
        }
    return faces


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


def face_normal_texture(romfs: str, portrait: str, lz13):
    """Decode the neutral-emotion body texture from a BU portrait arc."""
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
        name = archive.label_at(info_label + index * 16)
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


def extract_unit_faces(romfs: str, out_dir: str, units: list[dict], faces: dict, lz13):
    entries = {}
    missing = []
    for unit in units:
        fid = unit.get("fid") or ""
        part = fid[4:] if fid.startswith("FID_") else ""
        info = faces.get(f"FSID_BU_{part}") or faces.get(f"FSID_ST_{part}")
        if not info and unit.get("isCorrin"):
            info = faces.get(AVATAR_FALLBACK_FSID[unit["gender"]])
        if not info or not info["portrait"]:
            missing.append((unit["id"], unit["name"], "no FaceData entry"))
            continue
        texture = face_normal_texture(romfs, info["portrait"], lz13)
        if texture is None:
            missing.append((unit["id"], unit["name"], "no portrait arc"))
            continue
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

        x, y, width, height = info["bu"]
        if width and height and x + width <= image.width and y + height <= image.height:
            image = image.crop((x, y, x + width, y + height))
        side = max(image.width, image.height)
        padded = Image.new("RGBA", (side, side))
        padded.paste(image, ((side - image.width) // 2, (side - image.height) // 2), image)
        padded = padded.resize((FACE_BODY_SIZE, FACE_BODY_SIZE), Image.LANCZOS)
        file_name = f"assets/units/{unit['slot']}.webp"
        write_webp(padded, os.path.join(os.path.dirname(out_dir), *file_name.split("/")))
        entries[unit["id"]] = {
            "file": file_name,
            "source": f"face/face/{info['portrait']}.arc#通常 + hair",
        }
    return entries, missing


# --------------------------------- main ------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--romfs", default=DEFAULT_ROMFS)
    parser.add_argument("--fe-tools", default=DEFAULT_FE_TOOLS)
    parser.add_argument("--pack", default=DEFAULT_PACK)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    lz13 = load_lz13(args.fe_tools)
    units = read_json(os.path.join(args.pack, "units.json"))["units"]
    classes = read_json(os.path.join(args.pack, "classes.json"))["classes"]
    skills = read_json(os.path.join(args.pack, "skills.json"))["skills"]

    skill_entries, skill_missing, cell_count = extract_skill_icons(
        args.romfs, args.out, skills, lz13
    )
    class_entries, class_missing = extract_class_sprites(args.romfs, args.out, classes, lz13)
    faces = parse_face_data(args.romfs, lz13)
    unit_entries, unit_missing = extract_unit_faces(args.romfs, args.out, units, faces, lz13)

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Owner's romfs dump (work/cia-extract/romfs) via tools/assets/extract_assets.py",
        "coverage": {
            "skills": {"resolved": len(skill_entries), "total": len(skills), "iconCells": cell_count},
            "classes": {"resolved": len(class_entries), "total": len(classes)},
            "units": {"resolved": len(unit_entries), "total": len(units)},
        },
        "skills": skill_entries,
        "classes": class_entries,
        "units": unit_entries,
    }
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)
    with open(args.manifest, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    def report(label: str, entries: dict, missing: list, total: int) -> None:
        print(f"{label}: {len(entries)}/{total} ({100 * len(entries) / max(total, 1):.1f}%)")

    report("skills", skill_entries, skill_missing, len(skills))
    report("classes", class_entries, class_missing, len(classes))
    report("units", unit_entries, unit_missing, len(units))
    for label, missing in (("skill", skill_missing), ("class", class_missing), ("unit", unit_missing)):
        for entry in missing:
            print(f"  missing {label}: {entry}")
    print(f"manifest: {os.path.relpath(args.manifest, REPO_ROOT)}")


if __name__ == "__main__":
    main()
