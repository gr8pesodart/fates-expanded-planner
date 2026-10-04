#!/usr/bin/env python3
"""Extract the installed vanity mods' talk portraits and map sprites.

The overlay contains Dragon-Hare's male and female Corrin face archives and
Furry Fates' Kaden, Keaton, Selkie and Velouria archives. Furry Fates also
replaces Kaden/Keaton map heads, the male Kitsune body and their Unique forms.
Base art remains in portraits.json and sprites.json for runs with a vanity off.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO_ROOT, "tools", "assets"))

import extract_portraits as portraits  # noqa: E402
import extract_sprites as sprites  # noqa: E402

DEFAULT_OVERLAY = os.path.join(REPO_ROOT, "..", "3ds-games", "fe-fates", "work", "overlay", "romfs")
DEFAULT_PACK = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")
DEFAULT_OUT = os.path.join(REPO_ROOT, "public", "assets")
DEFAULT_MANIFEST = os.path.join(REPO_ROOT, "src", "data", "vanityArt.json")
DEFAULT_SHEET = os.path.join(REPO_ROOT, "docs", "screenshots", "v3", "vanity.png")

DRAGON_HARE = ("Corrin (M)", "Corrin (F)")
FURRY = ("Kaden", "Keaton", "Selkie", "Velouria")
MAP_UNITS = ("Kaden", "Keaton")


def output_path(out_dir: str, file_name: str) -> str:
    return os.path.join(os.path.dirname(out_dir), *file_name.split("/"))


def save_webp(image: Image.Image, out_dir: str, file_name: str) -> None:
    path = output_path(out_dir, file_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "WEBP", quality=portraits.WEBP_QUALITY, method=6)


def extract_portrait(unit: dict, base_face: dict, overlay: str, out_dir: str, mod: str, lz13, corrin_colour: bytes) -> dict:
    fid = unit.get("fid") or ""
    part = fid[4:] if fid.startswith("FID_") else ""
    info = base_face.get(f"FSID_ST_{part}")
    if not info and unit.get("isCorrin"):
        info = base_face.get(portraits.AVATAR_FALLBACK_FSID[unit["gender"]])
    if not info:
        raise ValueError(f"no FaceData for {unit['name']}")
    art, error = portraits.build_unit_art(overlay, info, lz13)
    if error:
        raise ValueError(f"{unit['name']}: {error}")
    colour = corrin_colour if unit.get("isCorrin") else info["hair_color"]
    canvas = portraits.composite_hair(art["base"], art["hair"], colour).crop(art["box"])
    file_name = f"assets/vanity/{mod}/portraits/{unit['slot']}.webp"
    save_webp(canvas, out_dir, file_name)
    entry = {
        "file": file_name,
        "w": canvas.width,
        "h": canvas.height,
        "face": art["face"],
        "bust": art["bust"],
        "faceRect": art["face_rect"],
        "source": f"installed mod overlay/face/face/{info['portrait']}.arc#通常",
    }
    if art["hair"] is not None:
        hair_canvas = art["hair"].crop(art["box"])
        hair_name = f"assets/vanity/{mod}/portraits/{unit['slot']}-hair.webp"
        save_webp(hair_canvas, out_dir, hair_name)
        entry["hair"] = {"file": hair_name, "w": hair_canvas.width, "h": hair_canvas.height}
    return entry


def portrait_crop(out_dir: str, entry: dict, side: int) -> Image.Image:
    with Image.open(output_path(out_dir, entry["file"])) as opened:
        canvas = opened.convert("RGBA")
    x, y, w, h = entry["bust"]
    return canvas.crop((x, y, x + w, y + h)).resize((side, side), Image.Resampling.LANCZOS)


def sprite_preview(out_dir: str, manifest: dict, unit_id: str, class_id: int) -> Image.Image:
    unit_body = manifest.get("unitBodies", {}).get(unit_id, {}).get(str(class_id))
    if unit_body:
        head = manifest["heads"].get(unit_id)
        if head and unit_body.get("head") and unit_body["head"].get("variant") == "small":
            head = head.get("small", head)
        return sprites.compose_contract(out_dir, unit_body, head)
    unique = manifest.get("unique", {}).get(unit_id, {}).get(str(class_id))
    if unique:
        return sprites.layer_cell(sprites.image_for(out_dir, unique["file"]), unique, 0)
    body = manifest["bodies"][str(class_id)]
    head = manifest["heads"].get(unit_id)
    if head and body.get("head") and body["head"].get("variant") == "small":
        head = head.get("small", head)
    return sprites.compose_contract(out_dir, body, head)


def extract_unit_bodies(overlay: str, out_dir: str, units: list[dict], classes: list[dict], lz13) -> dict:
    """Furry Fates Unique folders can still draw a separate head over their body."""
    entries = {}
    for unit in units:
        per_class = {}
        for class_def in classes:
            folder = sprites.unit_unique_folder(overlay, unit, class_def["jid"])
            if not folder:
                continue
            directory = os.path.join(overlay, "unit", "Unique", folder)
            animation = sprites.idle_animation(os.path.join(directory, "anime.bin"))
            frames = sprites.unique_idle_frames(animation, f"vanity {unit['name']} {class_def['name']}")
            animation_data = sprites.animation_contract(animation)
            head = dict(animation_data[0]["head"]) if animation_data[0]["head"] else None
            raw = sprites.load_display(os.path.join(directory, sprites.HEAD_FILE), lz13)
            image = Image.new("RGBA", (128, 32), (0, 0, 0, 0))
            for index, frame in frames.items():
                if frame.body_w != 32 or frame.body_h != 32 or frame.body_src_y != 0 or frame.body_src_x != index * 32:
                    raise ValueError(f"unexpected Furry Fates body cell in {folder}")
                cell = raw.crop((frame.body_src_x, frame.body_src_y, frame.body_src_x + 32, frame.body_src_y + 32))
                # Three fan-made sheets use 0x85/0x86 on a few opaque body pixels instead of 0x88.
                cell.putalpha(cell.getchannel("A").point(lambda value: 0x88 if value in (0x85, 0x86) else value))
                image.alpha_composite(sprites.layer_strip(cell, sprites.BODY_BANDS) if head else sprites.flatten(cell), (index * 32, 0))
            sprites.assert_binary_alpha(image, f"vanity {folder}")
            file_name = f"assets/vanity/furry/sprites/unit-bodies/{unit['slot']}-{class_def['id']}.webp"
            sprites.write_webp(image, output_path(out_dir, file_name))
            entry = {
                "file": file_name,
                "w": 32,
                "h": 32,
                "head": head,
                "frameCount": 4,
                "animation": sprites.compact_animation(animation_data, head),
                "source": f"installed mod overlay/unit/Unique/{folder}/{sprites.HEAD_FILE} + anime.bin",
            }
            if head:
                entry["layers"] = 1
            per_class[str(class_def["id"])] = entry
        if per_class:
            entries[unit["id"]] = per_class
    return entries


def contact_sheet(out_dir: str, path: str, selected: list[dict], base_portraits: dict, base_sprites: dict, vanity: dict, units: dict, classes: list[dict]) -> None:
    width, card, gap, pad = 1100, 148, 30, 24
    height = 600
    sheet = Image.new("RGB", (width, height), "#f6f6f6")
    draw = ImageDraw.Draw(sheet)
    font = portraits.load_font(14)
    title_font = portraits.load_font(20)
    draw.text((pad, 12), "Vanity portraits - base / mod", fill="#1b1b1b", font=title_font)
    for index, item in enumerate(selected):
        x = pad + index * (card + gap)
        unit = units[item["name"]]
        base = base_portraits[unit["id"]]
        mod = vanity[item["mod"]]["portraits"][unit["id"]]
        for row, entry in enumerate((base, mod)):
            tile = portrait_crop(out_dir, entry, card)
            y = 54 + row * 178
            sheet.paste(tile, (x, y), tile)
        draw.text((x, 54 + 2 * 178 - 19), item["name"], fill="#1b1b1b", font=font)
    draw.text((pad, 410), "Furry Fates map sprites - base / mod", fill="#1b1b1b", font=title_font)
    class_by_name = {item["name"]: item["id"] for item in classes}
    for index, (name, class_name) in enumerate([("Kaden", "Kitsune (M)"), ("Keaton", "Wolfskin (M)")]):
        unit = units[name]
        class_id = class_by_name[class_name]
        for row, art in enumerate((base_sprites, vanity["furryFates"]["sprites"])):
            image = sprite_preview(out_dir, art, unit["id"], class_id)
            image = image.resize((image.width * 3, image.height * 3), Image.Resampling.NEAREST)
            x = pad + index * 330 + row * 150
            sheet.paste(image, (x, 460), image)
            draw.text((x, 563), f"{name} {['base', 'mod'][row]}", fill="#1b1b1b", font=font)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--overlay", default=DEFAULT_OVERLAY)
    parser.add_argument("--romfs", default=portraits.DEFAULT_ROMFS)
    parser.add_argument("--fe-tools", default=portraits.DEFAULT_FE_TOOLS)
    parser.add_argument("--pack", default=DEFAULT_PACK)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--sheet", default=DEFAULT_SHEET)
    args = parser.parse_args()

    lz13 = portraits.load_lz13(args.fe_tools)
    units = portraits.read_json(os.path.join(args.pack, "units.json"))["units"]
    classes = portraits.read_json(os.path.join(args.pack, "classes.json"))["classes"]
    by_name = {unit["name"]: unit for unit in units}
    base_face = portraits.parse_face_data(args.romfs, lz13)
    base_sprites = portraits.read_json(os.path.join(REPO_ROOT, "src", "data", "sprites.json"))
    base_portraits = portraits.read_json(os.path.join(REPO_ROOT, "src", "data", "portraits.json"))["units"]
    first_colour = base_sprites["corrinHairColours"][0].lstrip("#")
    corrin_colour = bytes.fromhex(first_colour[:6])

    vanity = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Owner's installed Dragon-Hare Corrin and Furry Fates mod overlay",
        "dragonHare": {"portraits": {}},
        "furryFates": {"portraits": {}, "sprites": {}},
    }
    selected = []
    for mod, names in (("dragonHare", DRAGON_HARE), ("furryFates", FURRY)):
        folder = "dragon-hare" if mod == "dragonHare" else "furry"
        for name in names:
            unit = by_name[name]
            vanity[mod]["portraits"][unit["id"]] = extract_portrait(unit, base_face, args.overlay, args.out, folder, lz13, corrin_colour)
            selected.append({"name": name, "mod": mod})

    map_units = [by_name[name] for name in MAP_UNITS]
    map_classes = [item for item in classes if item["name"] == "Kitsune (M)"]
    prefix = "assets/vanity/furry/sprites"
    bodies, missing_bodies = sprites.extract_bodies(args.overlay, args.overlay, args.out, map_classes, lz13, prefix)
    heads, missing_heads = sprites.extract_heads(args.overlay, args.out, map_units, lz13, prefix)
    unit_bodies = extract_unit_bodies(args.overlay, args.out, map_units, classes, lz13)
    if missing_bodies or missing_heads or not unit_bodies:
        raise ValueError(f"incomplete Furry Fates map sprites: {missing_bodies}, {missing_heads}")
    vanity["furryFates"]["sprites"] = {"bodies": bodies, "heads": heads, "unitBodies": unit_bodies}

    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)
    with open(args.manifest, "w", encoding="utf-8", newline="\n") as output:
        json.dump(vanity, output, ensure_ascii=False, separators=(",", ":"))
        output.write("\n")
    contact_sheet(args.out, args.sheet, selected, base_portraits, base_sprites, vanity, by_name, classes)
    print(f"vanity portraits: {len(selected)}")
    print(f"furry map sprites: {len(bodies)} body, {len(heads)} heads, {sum(len(rows) for rows in unit_bodies.values())} unit bodies")
    print(f"manifest: {args.manifest}")
    print(f"contact sheet: {args.sheet}")


if __name__ == "__main__":
    main()
