"""Extract reclass items and skill books (with their icons) for the Progression page and skill access.

The installed build uses the Fates Icon Project (regular), which redraws the item sheet and repoints
items at new cells (e.g. Heart Seal 26 -> 324). So item data comes from the installed build's GameData
(`work/merge/GameData.bin.lz`) and the pixels from the Icon Project's `icon/Icon.bch.lz` texture
"item" (16x16 cells, 16 per row). English names come from the vanilla message archive (MIID_*).

Item table: GameData header (at 0x20) word 11 points at the table, records start 0x10 later, 104
bytes each:
  +0   u32  pointer to the IID string (Shift-JIS)
  +16  u16  icon cell
  +19  u8   kind: 11 = seal / class-change item, 12 = skill book
  +56  u8   seals: 0 Master, 1 Heart, 2 Partner, 3 Friendship, 4 Eternal, 5 class change, 6 Offspring
            skill books: the skill id taught
  +57  u8   class change: the class id; skill books: unknown (25 for Aether, 35 for Warp, 10 for
            Veteran Intuition, 0 for the rest)

  python tools/assets/extract_item_icons.py
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
sys.path.insert(0, os.path.join(REPO_ROOT, "tools", "extract"))

import fe_assets  # noqa: E402

FATES = os.path.join(REPO_ROOT, "..", "3ds-games", "fe-fates")
DEFAULT_GAMEDATA = os.path.join(FATES, "work", "merge", "GameData.bin.lz")
DEFAULT_MESSAGES = os.path.join(FATES, "work", "cia-extract", "romfs", "m", "@E", "GameData.bin.lz")
DEFAULT_ICONS = os.path.join(FATES, "work", "mods", "icon-project", "regular", "Regular Version", "romfs", "icon", "Icon.bch.lz")
DEFAULT_FE_TOOLS = os.path.join(FATES, "tools")
DEFAULT_PACK = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")
DEFAULT_OUT = os.path.join(REPO_ROOT, "public", "assets", "items")
DEFAULT_MANIFEST = os.path.join(REPO_ROOT, "src", "data", "itemIcons.json")

CELL = 16
RECORD = 104
KIND_SEAL = 11
KIND_BOOK = 12
SEAL_KEYS = {0: "master", 1: "heart", 2: "partner", 3: "friendship", 4: "eternal", 6: "offspring"}
SEAL_CLASS_CHANGE = 5


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def items(raw: bytes) -> list[dict]:
    base = 0x20
    offset = struct.unpack_from("<I", raw, base + 11 * 4)[0] + base + 0x10
    result = []
    while offset + RECORD <= len(raw):
        pointer = struct.unpack_from("<I", raw, offset)[0] + base
        if pointer >= len(raw):
            break
        name = raw[pointer:raw.find(b"\x00", pointer)].decode("shift_jis", errors="replace")
        if not name.startswith("IID_"):
            break
        result.append({
            "index": len(result),
            "iid": name,
            "icon": struct.unpack_from("<H", raw, offset + 16)[0],
            "kind": raw[offset + 19],
            "arg": raw[offset + 56],
            "arg2": raw[offset + 57],
        })
        offset += RECORD
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--gamedata", default=DEFAULT_GAMEDATA)
    parser.add_argument("--messages", default=DEFAULT_MESSAGES)
    parser.add_argument("--icons", default=DEFAULT_ICONS)
    parser.add_argument("--fe-tools", default=DEFAULT_FE_TOOLS)
    parser.add_argument("--pack", default=DEFAULT_PACK)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    sys.path.insert(0, os.path.abspath(args.fe_tools))
    from fe_tools import lz13  # noqa: PLC0415
    import extract_game_data  # noqa: PLC0415

    messages = extract_game_data.read_message_archive(args.messages, lz13)
    with open(os.path.join(args.pack, "classes.json"), encoding="utf-8") as f:
        class_names = {c["id"]: c["name"] for c in json.load(f)["classes"]}
    with open(os.path.join(args.pack, "skills.json"), encoding="utf-8") as f:
        skill_names = {s["id"]: s["name"] for s in json.load(f)["skills"]}

    table = items(lz13.decompress(open(args.gamedata, "rb").read()))
    textures = {t.name: t for t in fe_assets.bch_textures(lz13.decompress(open(args.icons, "rb").read()))}
    if "item" not in textures:
        fail("Icon.bch.lz has no 'item' texture")
    texture = textures["item"]
    sheet = Image.frombytes("RGBA", (texture.width, texture.height), texture.rgba)
    columns = sheet.width // CELL

    entries: dict[str, dict] = {}
    seals: dict[str, str] = {}
    class_items: dict[str, str] = {}
    books: dict[str, str] = {}

    def add(key: str, item: dict, name: str) -> None:
        column, row = item["icon"] % columns, item["icon"] // columns
        icon = sheet.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL))
        os.makedirs(args.out, exist_ok=True)
        icon.save(os.path.join(args.out, f"{key}.webp"), "WEBP", lossless=True, quality=100, method=6)
        entries[key] = {
            "file": f"assets/items/{key}.webp",
            "name": name,
            "source": f"Icon Project icon/Icon.bch.lz#item[{column},{row}] (icon {item['icon']}; item {item['index']} {item['iid']}, work/merge GameData)",
        }

    for item in table:
        english = messages.get("MIID_" + item["iid"][4:])
        if item["kind"] == KIND_SEAL and item["arg"] in SEAL_KEYS:
            key = SEAL_KEYS[item["arg"]]
            seals[key] = key
            add(key, item, english or key)
        elif item["kind"] == KIND_SEAL and item["arg"] == SEAL_CLASS_CHANGE:
            class_id = item["arg2"]
            key = f"class-{class_id}"
            class_items[str(class_id)] = key
            # The amiibo classes' items have no English name; name them after their class.
            add(key, item, english or f"{class_names.get(class_id, class_id)} item")
        elif item["kind"] == KIND_BOOK:
            skill_id = item["arg"]
            key = f"book-{skill_id}"
            books[str(skill_id)] = key
            add(key, item, english or f"{skill_names.get(skill_id, skill_id)} book")

    for required in ("master", "heart", "partner", "friendship", "eternal"):
        if required not in seals:
            fail(f"no {required} seal in the item table")

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Installed GameData item table + Fates Icon Project (regular) item sheet (tools/assets/extract_item_icons.py)",
        "seals": seals,
        "classItems": class_items,
        "books": books,
        "items": entries,
    }
    with open(args.manifest, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"items: {len(seals)} seals, {len(class_items)} class items, {len(books)} skill books -> {os.path.relpath(args.manifest, REPO_ROOT)}")


if __name__ == "__main__":
    main()
