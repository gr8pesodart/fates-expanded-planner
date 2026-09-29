#!/usr/bin/env python3
"""Extract units, classes and skills for the planner from FE Fates GameData.

Stats, growths, cap modifiers, class sets and class skills are read directly
from the decompressed `GameData.bin` using the table layouts documented by
RainThunder's Nightmare modules (https://github.com/RainThunder/fefates-tools):

  Character table: 0xDF0, 255 entries x 152 bytes
  Class table:     0xEA10, 129 entries x 128 bytes
  Skill table:     0x12BBC, 229 entries x 32 bytes (located via the GameData
                   header pointers, not hard-coded)

English display names come from RainThunder's enum lists (Character.txt,
Class.txt, Skill.txt), cached in tools/extract/sources/ (gitignored). Skill
descriptions are read from the game's own English message archive
(`m/@E/GameData.bin.lz`): the skill table stores message keys, which the
message archive maps to UTF-16 English text.

Additions on top of the base tables:

  - skill descriptions + icon indices (skill table)
  - explicit learn levels per class (`skillLearn`, from the class tier)
  - DLC flags: classes store a DLC index byte (0-7 = the eight DLC classes,
    255 = not DLC); skills that only a DLC class teaches are flagged; Anna is
    the one DLC-only playable unit (curated, see docs/DATA.md)
  - route availability per unit, decoded from the character `support route`
    byte and cross-checked against community sources (docs/DATA.md)
  - per-unit pair-up support bonuses: the C/B/A/S stat table sits 40 bytes
    after the character's guard-stance bonus pointer (verified against
    Serenes Forest's published pair-up tables)
  - class pair-up bonuses (`pairUp`) are already in the class table

The vanilla table is used because the installed build's UGF changes do not
touch unit stats or classes (see docs/MODS.md); the support graph is
extracted separately from the mod's own Paragon export.

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
DEFAULT_MESSAGES = os.path.join(
    REPO_ROOT,
    "..",
    "3ds-games",
    "fe-fates",
    "work",
    "cia-extract",
    "romfs",
    "m",
    "@E",
    "GameData.bin.lz",
)

SOURCE_URLS = {
    "Character.txt": "https://raw.githubusercontent.com/RainThunder/fefates-tools/master/Character/Character.txt",
    "Class.txt": "https://raw.githubusercontent.com/RainThunder/fefates-tools/master/Character/Class.txt",
    "Skill.txt": "https://raw.githubusercontent.com/RainThunder/fefates-tools/master/Character/Skill.txt",
}

CHAR_OFF, CHAR_SIZE, CHAR_COUNT = 0xDF0, 152, 255
CLASS_OFF, CLASS_SIZE, CLASS_COUNT = 0xEA10, 128, 129
SKILL_SIZE, SKILL_COUNT = 32, 229
FIRST_PLAYABLE_SLOT, LAST_PLAYABLE_SLOT = 1, 71  # Corrin (M) .. Anna

STAT_FIELDS = ("hp", "str", "mag", "skl", "spd", "lck", "def", "res")
WEAPON_FIELDS = ("sword", "lance", "axe", "dagger", "bow", "tome", "staff", "stone")

# Support route byte -> routes the unit can be recruited in. The byte is the
# same field the support graph uses; groups verified against Fire Emblem Wiki
# / Fandom route lists (docs/DATA.md).
ROUTE_BY_SUPPORT_ROUTE: dict[int, list[str]] = {
    1: ["birthright"],
    2: ["conquest", "revelation"],
    3: ["birthright", "conquest"],
    4: ["revelation"],
    5: ["birthright", "revelation"],
    6: ["conquest", "revelation"],
    7: ["birthright", "conquest", "revelation"],
}

# Anna is the only playable unit gated behind a DLC xenologue ("Anna on the
# Run"); no table flag exists for units (docs/DATA.md).
DLC_UNIT_IDS = {"PID_アンナ"}

SKILL_LEVELS = {
    "base": (1, 10),
    "promoted": (5, 15),
    "special": (1, 10, 25, 35),
}


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


def u16(rec: bytes, offset: int) -> int:
    return struct.unpack_from("<H", rec, offset)[0]


def u32(rec: bytes, offset: int) -> int:
    return struct.unpack_from("<I", rec, offset)[0]


def read_message_archive(path: str, lz13) -> dict[str, str]:
    """English message key -> text from an FE Fates text archive.

    Text archives are BinArchives whose data section holds null-terminated
    UTF-16LE strings on 4-byte boundaries; each string carries a label (the
    message key the game data references).
    """
    if not os.path.isfile(path):
        fail(f"message archive not found: {path} (pass --messages)")
    raw = open(path, "rb").read()
    data = lz13.decompress(raw)
    data_size, pointer_count, label_count = struct.unpack_from("<III", data, 4)
    text_start = 0x20 + data_size + pointer_count * 4 + label_count * 8

    labels: dict[int, str] = {}
    for index in range(label_count):
        offset = 0x20 + data_size + pointer_count * 4 + index * 8
        address, text_offset = struct.unpack_from("<II", data, offset)
        start = text_start + text_offset
        end = data.index(b"\x00", start)
        labels[address] = data[start:end].decode("shift_jis", errors="replace")

    messages: dict[str, str] = {}
    position = 0
    while position < data_size:
        if position in labels:
            end = position
            while data[0x20 + end] or data[0x20 + end + 1]:
                end += 2
            messages[labels[position]] = data[0x20 + position : 0x20 + end].decode(
                "utf-16-le", errors="replace"
            )
            position = end + 2
            while position % 4:
                position += 1
        else:
            position += 2
    return messages


def gamedata_tables(data: bytes) -> dict[str, int]:
    """Resolve table offsets from the GameData header (data starts at 0x20).

    Field order follows Paragon's FE14 GameData type: character table pointer
    at +0x08, job table at +0x0C, skill table at +0x10, normal skill count at
    +0x14, total skill count at +0x18.
    """
    base = 0x20
    tables = {
        "characters": u32(data, base + 0x08) + base,
        "classes": u32(data, base + 0x0C) + base,
        "skills": u32(data, base + 0x10) + base,
        "normal_skill_count": u32(data, base + 0x14),
        "total_skill_count": u32(data, base + 0x18),
    }
    if tables["characters"] + 16 != CHAR_OFF:
        fail(f"character table moved (header says {tables['characters'] + 16:#x})")
    if tables["classes"] + 8 != CLASS_OFF:
        fail(f"class table moved (header says {tables['classes'] + 8:#x})")
    return tables


def skill_learn_levels(tier: str, count: int) -> list[int]:
    return list(SKILL_LEVELS[tier][:count])


def build(
    gamedata_path: str,
    fe_tools_path: str,
    sources_dir: str,
    messages_path: str,
    skip_download: bool,
) -> dict:
    lz13 = load_fe_tools(fe_tools_path)
    raw_file = open(gamedata_path, "rb").read()
    data = lz13.decompress(raw_file)
    sources = fetch_sources(sources_dir, skip_download)
    messages = read_message_archive(messages_path, lz13)
    tables = gamedata_tables(data)

    char_names = parse_enum_list(sources["Character.txt"])
    class_names = parse_enum_list(sources["Class.txt"])
    skill_names = parse_enum_list(sources["Skill.txt"])

    if len(class_names) < CLASS_COUNT:
        fail(f"class list too short ({len(class_names)} < {CLASS_COUNT})")
    if len(skill_names) < 229:
        fail(f"skill list too short ({len(skill_names)})")
    if tables["total_skill_count"] != SKILL_COUNT:
        fail(f"expected {SKILL_COUNT} skills, header says {tables['total_skill_count']}")

    def string_at(ptr: int) -> str:
        if ptr == 0:
            return ""
        offset = ptr + 0x20
        end = data.index(b"\x00", offset)
        return data[offset:end].decode("shift_jis", errors="replace")

    def message_at(ptr: int) -> str | None:
        key = string_at(ptr)
        return messages.get(key) if key else None

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

    def u16_local(rec: bytes, offset: int) -> int:
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
        classes = [u16_local(rec, 44), u16_local(rec, 46)]
        reclasses = [u16_local(rec, 124), u16_local(rec, 126)]
        parent_cid = u16_local(rec, 42)
        fixed_parent = cid_to_pid.get(parent_cid) if parent_cid not in (0, 0xFFFF) else None
        personal = [u16_local(rec, o) for o in (116, 118, 120)]
        route_byte = rec[38]
        routes = ROUTE_BY_SUPPORT_ROUTE.get(route_byte)
        if routes is None:
            fail(f"unknown support route {route_byte} for {pid}")
        fid = string_at(u32(rec, 12))
        guard_ptr = u32(rec, 32)
        attack_ptr = u32(rec, 28)
        support_bonuses = [
            list(data[guard_ptr + 40 + row * 8 : guard_ptr + 48 + row * 8]) for row in range(4)
        ]
        attack_bonuses = [
            list(data[attack_ptr + row * 4 : attack_ptr + row * 4 + 4]) for row in range(5)
        ]
        units.append(
            {
                "id": pid,
                "name": char_names[slot] if slot < len(char_names) else pid[4:],
                "fid": fid or None,
                "slot": slot,
                "gender": "female" if rec[0] & 0x01 else "male",
                "supportRoute": route_byte,
                "routes": routes,
                "dlc": pid in DLC_UNIT_IDS,
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
                "supportBonuses": support_bonuses,
                "attackBonuses": attack_bonuses,
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
        tier = "promoted" if promoted else ("base" if promotes_to else "special")
        skill_ids = [s for s in (u16(rec, o) for o in (84, 86, 88, 90)) if s]
        skill_learn = [
            {"id": skill_id, "level": level}
            for skill_id, level in zip(skill_ids, skill_learn_levels(tier, len(skill_ids)))
        ]
        classes.append(
            {
                "id": index,
                "name": class_names[index],
                "ja": ja,
                "jid": string_at(struct.unpack_from("<I", rec, 8)[0]),
                "tier": tier,
                "dlc": rec[123] != 0xFF,
                "baseStats": read_stats(rec, 28, signed=True),
                "growths": read_stats(rec, 36),
                "caps": read_stats(rec, 52),
                "pairUp": read_stats(rec, 60),
                "weaponRanks": list(rec[68:76]),
                "skills": skill_ids,
                "skillLearn": skill_learn,
                "promotesTo": promotes_to,
                "promotesFrom": promotes_from,
                "movement": rec[93],
            }
        )

    # --- skill table -------------------------------------------------------
    # The GameData skill-table pointer already points at the first entry
    # (verified: entry 0 = SEID_無し at 0x12BBC with the vanilla header).
    skill_table = tables["skills"]
    skill_rows: list[dict] = []
    for index in range(tables["total_skill_count"]):
        start = skill_table + index * SKILL_SIZE
        rec = data[start : start + SKILL_SIZE]
        skill_rows.append(
            {
                "id": index,
                "name_key": string_at(u32(rec, 4)),
                "description": message_at(u32(rec, 8)),
                "icon": u16(rec, 20),
            }
        )

    dlc_class_ids = {c["id"] for c in classes if c["dlc"]}
    skill_class_sources: dict[int, set[int]] = {}
    for class_def in classes:
        for skill_id in class_def["skills"]:
            skill_class_sources.setdefault(skill_id, set()).add(class_def["id"])
    dlc_personal_skills = {
        skill_id
        for unit in units
        if unit["dlc"]
        for skill_id in unit["personalSkills"].values()
        if skill_id
    }

    name_mismatches = 0
    skills: list[dict] = []
    for index, row in enumerate(skill_rows):
        name = skill_names[index]
        game_name = messages.get(row["name_key"]) if row["name_key"] else None
        if game_name and game_name != name:
            name_mismatches += 1
        sources_for_skill = skill_class_sources.get(index, set())
        skills.append(
            {
                "id": index,
                "name": name,
                "description": row["description"],
                "icon": row["icon"],
                "dlc": (
                    (bool(sources_for_skill) and sources_for_skill <= dlc_class_ids)
                    or index in dlc_personal_skills
                ),
            }
        )

    sha256 = hashlib.sha256(raw_file).hexdigest()
    messages_sha = hashlib.sha256(open(messages_path, "rb").read()).hexdigest()
    described = sum(1 for skill in skills if skill["description"])
    dlc_skills = sum(1 for skill in skills if skill["dlc"])
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = {
        "generatedAt": generated,
        "source": {
            "file": os.path.basename(gamedata_path),
            "sha256": sha256,
            "tool": "tools/extract/extract_game_data.py",
        },
        "messageSource": {
            "file": os.path.basename(messages_path),
            "sha256": messages_sha,
            "note": "English (US) text archive; skill table stores message keys resolved here.",
        },
        "tables": {
            "characters": "0xDF0/152",
            "classes": "0xEA10/128",
            "skills": f"{tables['skills']:#x}/{SKILL_SIZE}",
            "normalSkillCount": tables["normal_skill_count"],
            "totalSkillCount": tables["total_skill_count"],
        },
        "counts": {
            "units": len(units),
            "classes": len(classes),
            "skills": len(skills),
            "skillsWithDescription": described,
            "dlcClasses": sum(1 for c in classes if c["dlc"]),
            "dlcSkills": dlc_skills,
            "nameMismatches": name_mismatches,
        },
        "notes": [
            "Vanilla GameData: the installed build's stats/classes are unchanged by UGF (docs/MODS.md).",
            "English names from RainThunder's fefates-tools enum lists; descriptions from m/@E/GameData.bin.lz.",
            "DLC classes carry a DLC index byte (0-7) at class record +123; skills taught only by DLC classes are flagged dlc.",
            "Anna is the only DLC-only playable unit (curated: 'Anna on the Run' xenologue) — no unit table flag exists.",
            "routes = the character's 'support route' byte (1..7) decoded per docs/DATA.md, cross-checked against route lists.",
            "supportBonuses = C/B/A/S rows x 8 stats, read 40 bytes after the character's guard-stance bonus pointer; verified against Serenes Forest's pair-up tables.",
            "attackBonuses = hit/crit/avoid/dodge rows for no/C/B/A/S support.",
            "The 40-byte block at the guard-stance pointer (named GuardStanceBonuses by FE14 modding tools) is not exposed; its semantics are unconfirmed.",
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
    parser.add_argument("--messages", default=DEFAULT_MESSAGES)
    parser.add_argument("--out", default=DEFAULT_PACK_DIR)
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()

    result = build(
        args.gamedata, args.fe_tools, args.sources, args.messages, args.skip_download
    )

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
        f"{len(result['skills'])} skills "
        f"({result['meta']['counts']['skillsWithDescription']} with descriptions, "
        f"{result['meta']['counts']['dlcClasses']} DLC classes, "
        f"{result['meta']['counts']['dlcSkills']} DLC-only skills)"
    )


if __name__ == "__main__":
    main()
