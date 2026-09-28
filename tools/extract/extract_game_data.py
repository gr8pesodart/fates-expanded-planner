#!/usr/bin/env python3
"""Extract units, classes and skills for the planner from FE Fates GameData.

Stats, growths, cap modifiers, class sets and class skills are read directly
from the decompressed `GameData.bin` using the table layouts documented by
RainThunder's Nightmare modules (https://github.com/RainThunder/fefates-tools):

  Character table: 0xDF0, 255 entries x 152 bytes
  Class table:     0xEA10, 129 entries x 128 bytes

English display names come from RainThunder's enum lists (Character.txt,
Class.txt, Skill.txt), cached in tools/extract/sources/ (gitignored). The
vanilla table is used because the installed build's UGF changes do not touch
unit stats or classes (see docs/MODS.md); the support graph is extracted
separately from the mod's own Paragon export.

Usage (from the repo root):

    python tools/extract/extract_game_data.py

Sources default to the sibling fe-fates build if present.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
import urllib.request
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_PACK_DIR = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")
DEFAULT_GAMEDATA = os.path.join(
    REPO_ROOT,
    "..",
    "3ds-games",
    "fe-fates",
    "work",
    "cia-extract",
    "romfs",
    "GameData",
    "GameData.bin.lz",
)
DEFAULT_FE_TOOLS = os.path.join(REPO_ROOT, "..", "3ds-games", "fe-fates", "tools")
DEFAULT_SOURCES = os.path.join(REPO_ROOT, "tools", "extract", "sources")

SOURCE_URLS = {
    "Character.txt": "https://raw.githubusercontent.com/RainThunder/fefates-tools/master/Character/Character.txt",
    "Class.txt": "https://raw.githubusercontent.com/RainThunder/fefates-tools/master/Character/Class.txt",
    "Skill.txt": "https://raw.githubusercontent.com/RainThunder/fefates-tools/master/Character/Skill.txt",
}

CHAR_OFF, CHAR_SIZE, CHAR_COUNT = 0xDF0, 152, 255
CLASS_OFF, CLASS_SIZE, CLASS_COUNT = 0xEA10, 128, 129
FIRST_PLAYABLE_SLOT, LAST_PLAYABLE_SLOT = 1, 71  # Corrin (M) .. Anna

STAT_FIELDS = ("hp", "str", "mag", "skl", "spd", "lck", "def", "res")
WEAPON_FIELDS = ("sword", "lance", "axe", "dagger", "bow", "tome", "staff", "stone")


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def load_fe_tools(path: str):
    path = os.path.abspath(path)
    if not os.path.isfile(os.path.join(path, "fe_tools", "lz13.py")):
        fail(f"fe_tools not found under {path} (pass --fe-tools)")
    sys.path.insert(0, path)
    from fe_tools import lz13  # noqa: PLC0415

    return lz13


def fetch_sources(directory: str, skip_download: bool) -> dict[str, str]:
    os.makedirs(directory, exist_ok=True)
    texts: dict[str, str] = {}
    for name, url in SOURCE_URLS.items():
        path = os.path.join(directory, name)
        if not os.path.isfile(path):
            if skip_download:
                fail(f"missing source list {path} (drop it there or allow downloads)")
            print(f"downloading {name} ...")
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read()
            with open(path, "wb") as f:
                f.write(data)
        with open(path, "r", encoding="utf-8") as f:
            texts[name] = f.read()
    return texts


def parse_enum_list(text: str) -> list[str]:
    """Parse `0x1F Name` lines from a Nightmare txt list (skips any count line)."""
    names: list[str] = []
    for line in (l.rstrip("\n") for l in text.splitlines()):
        line = line.strip()
        if not line:
            continue
        if line.isdigit():  # leading count line
            continue
        if line.lower().startswith("0x"):
            _, _, rest = line.partition(" ")
            names.append(rest.strip())
        else:
            names.append(line)
    return names


def signed8(value: int) -> int:
    return value - 256 if value > 127 else value


def read_stats(rec: bytes, offset: int, signed: bool = False) -> list[int]:
    values = list(rec[offset : offset + 8])
    return [signed8(v) if signed else v for v in values]


def build(gamedata_path: str, fe_tools_path: str, sources_dir: str, skip_download: bool) -> dict:
    lz13 = load_fe_tools(fe_tools_path)
    raw_file = open(gamedata_path, "rb").read()
    data = lz13.decompress(raw_file)
    sources = fetch_sources(sources_dir, skip_download)

    char_names = parse_enum_list(sources["Character.txt"])
    class_names = parse_enum_list(sources["Class.txt"])
    skill_names = parse_enum_list(sources["Skill.txt"])

    if len(class_names) < CLASS_COUNT:
        fail(f"class list too short ({len(class_names)} < {CLASS_COUNT})")
    if len(skill_names) < 229:
        fail(f"skill list too short ({len(skill_names)})")

    def string_at(ptr: int) -> str:
        if ptr == 0:
            return ""
        offset = ptr + 0x20
        end = data.index(b"\x00", offset)
        return data[offset:end].decode("shift_jis", errors="replace")

    # --- character table ---------------------------------------------------
    cid_to_pid: dict[int, str] = {}
    parsed: list[dict] = []
    for slot in range(CHAR_COUNT):
        base = CHAR_OFF + slot * CHAR_SIZE
        rec = data[base : base + CHAR_SIZE]
        pid = string_at(struct.unpack_from("<I", rec, 8)[0])
        cid = struct.unpack_from("<H", rec, 36)[0]
        if pid and pid != "PID_無し":
            cid_to_pid[cid] = pid
        parsed.append(
            {
                "slot": slot,
                "pid": pid,
                "cid": cid,
                "rec": rec,
            }
        )

    def u16(rec: bytes, offset: int) -> int:
        return struct.unpack_from("<H", rec, offset)[0]

    units: list[dict] = []
    for entry in parsed:
        slot = entry["slot"]
        if not (FIRST_PLAYABLE_SLOT <= slot <= LAST_PLAYABLE_SLOT):
            continue
        rec = entry["rec"]
        pid = entry["pid"]
        if not pid:
            continue
        classes = [u16(rec, 44), u16(rec, 46)]
        reclasses = [u16(rec, 124), u16(rec, 126)]
        parent_cid = u16(rec, 42)
        fixed_parent = cid_to_pid.get(parent_cid) if parent_cid not in (0, 0xFFFF) else None
        personal = [u16(rec, o) for o in (116, 118, 120)]
        units.append(
            {
                "id": pid,
                "name": char_names[slot] if slot < len(char_names) else pid[4:],
                "slot": slot,
                "gender": "female" if rec[0] & 0x01 else "male",
                "supportRoute": rec[38],
                "levelCap": rec[134] * 10 or None,
                "baseStats": read_stats(rec, 56, signed=True),
                "growths": read_stats(rec, 64),
                "capMods": read_stats(rec, 72, signed=True),
                "classes": [c for c in classes if c],
                "reclasses": [c for c in reclasses if c],
                "weaponRanks": list(rec[96:104]),
                "personalSkills": {
                    "birthright": personal[0] or None,
                    "conquest": personal[1] or None,
                    "revelation": personal[2] or None,
                },
                "fixedParent": fixed_parent,
                "isCorrin": pid in ("PID_プレイヤー男", "PID_プレイヤー女"),
            }
        )
    if len(units) < 60:
        fail(f"only {len(units)} playable units parsed — table layout drift?")

    # --- class table -------------------------------------------------------
    promo_of: dict[int, list[int]] = {}
    for index in range(CLASS_COUNT):
        rec = data[CLASS_OFF + index * CLASS_SIZE : CLASS_OFF + (index + 1) * CLASS_SIZE]
        for offset in (100, 102):
            target = u16(rec, offset)
            if target:
                promo_of.setdefault(target, []).append(index)

    classes: list[dict] = []
    for index in range(CLASS_COUNT):
        rec = data[CLASS_OFF + index * CLASS_SIZE : CLASS_OFF + (index + 1) * CLASS_SIZE]
        ja = string_at(struct.unpack_from("<I", rec, 16)[0])
        if ja.startswith("MJID_"):
            ja = ja[5:]
        promotes_to = [c for c in (u16(rec, 100), u16(rec, 102)) if c]
        promotes_from = [c for c in (u16(rec, 104), u16(rec, 106)) if c]
        promoted = bool(promotes_from) or index in promo_of
        classes.append(
            {
                "id": index,
                "name": class_names[index],
                "ja": ja,
                "tier": "promoted" if promoted else ("base" if promotes_to else "special"),
                "baseStats": read_stats(rec, 28, signed=True),
                "growths": read_stats(rec, 36),
                "caps": read_stats(rec, 52),
                "pairUp": read_stats(rec, 60),
                "weaponRanks": list(rec[68:76]),
                "skills": [s for s in (u16(rec, o) for o in (84, 86, 88, 90)) if s],
                "promotesTo": promotes_to,
                "promotesFrom": promotes_from,
                "movement": rec[93],
            }
        )

    skills = [{"id": i, "name": skill_names[i]} for i in range(len(skill_names))]

    sha256 = hashlib.sha256(raw_file).hexdigest()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = {
        "generatedAt": generated,
        "source": {
            "file": os.path.basename(gamedata_path),
            "sha256": sha256,
            "tool": "tools/extract/extract_game_data.py",
        },
        "tables": {"characters": "0xDF0/152", "classes": "0xEA10/128"},
        "notes": [
            "Vanilla GameData: the installed build's stats/classes are unchanged by UGF (docs/MODS.md).",
            "English names from RainThunder's fefates-tools enum lists; stat/skill facts come from the game file.",
            "Child class sets: own branch + fixed parent's primary branch (+ variable parent / seal branches at runtime).",
            "Child growths = floor((child growths + variable parent growths) / 2); child cap mods = parents' mods (+1 if the variable parent is not a child).",
        ],
    }

    return {"units": units, "classes": classes, "skills": skills, "meta": meta}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--gamedata", default=DEFAULT_GAMEDATA)
    parser.add_argument("--fe-tools", default=DEFAULT_FE_TOOLS)
    parser.add_argument("--sources", default=DEFAULT_SOURCES)
    parser.add_argument("--out", default=DEFAULT_PACK_DIR)
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()

    result = build(args.gamedata, args.fe_tools, args.sources, args.skip_download)

    os.makedirs(args.out, exist_ok=True)

    def write_json(name: str, payload) -> None:
        path = os.path.join(args.out, name)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"wrote {os.path.relpath(path, REPO_ROOT)}")

    write_json(
        "units.json",
        {"meta": result["meta"], "units": result["units"]},
    )
    write_json(
        "classes.json",
        {"meta": result["meta"], "classes": result["classes"]},
    )
    write_json(
        "skills.json",
        {"meta": result["meta"], "skills": result["skills"]},
    )
    print(
        f"done: {len(result['units'])} units, {len(result['classes'])} classes, "
        f"{len(result['skills'])} skills"
    )


if __name__ == "__main__":
    main()
