#!/usr/bin/env python3
"""Extract the Unofficial Gay Fates support graph into a planner data pack.

Source: the Paragon `UGF.json` export that ships with the mod
(`Unofficial Gay Fates v2.5.2/Paragon Imports/UGF.json`). It is a plain
UTF-8 JSON describing, among other modules:

  Services.Supports:  pid -> pid -> { "character": pid, "support_type": u32 }
  Modules.Characters: pid -> { "Support Route": int, ... }   (only changes)

The raw `support_type` packs four support-point thresholds, high byte first:
`S<<24 | A<<16 | B<<8 | C`, where 0xFF means the rank is unreachable
(platonic supports store 0xFF for S). The web app decodes this at runtime,
so the pack stores raw ints only.

Usage (from the repo root):

    python tools/extract/extract_ugf_supports.py \
        --source "../3ds-games/fe-fates/work/mods/unofficial-gay-fates/Unofficial Gay Fates v2.5.2/Paragon Imports/UGF.json"

If --source is omitted the script tries the default fe-fates build path.
Outputs to src/data/packs/ugf-2.5.2/ (characters.json, supports.json, meta.json).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_PACK_DIR = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")
DEFAULT_SOURCE = os.path.join(
    REPO_ROOT,
    "..",
    "3ds-games",
    "fe-fates",
    "work",
    "mods",
    "unofficial-gay-fates",
    "Unofficial Gay Fates v2.5.2",
    "Paragon Imports",
    "UGF.json",
)

CORRIN_IDS = {"PID_プレイヤー男", "PID_プレイヤー女"}
RANK_LOCKED = 0xFF


def decode_support_type(raw: int) -> dict:
    """Mirror of src/data/types.ts decodeSupportType (kept for meta stats only)."""
    u = raw & 0xFFFFFFFF
    c, b, a, s = u & 0xFF, (u >> 8) & 0xFF, (u >> 16) & 0xFF, (u >> 24) & 0xFF
    return {
        "c": None if c == RANK_LOCKED else c,
        "b": None if b == RANK_LOCKED else b,
        "a": None if a == RANK_LOCKED else a,
        "s": None if s == RANK_LOCKED else s,
        "kind": "romantic" if s != RANK_LOCKED else "platonic",
        "fast": c < 4 and c != RANK_LOCKED,
    }


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def load_source(path: str) -> dict:
    if not os.path.isfile(path):
        fail(
            f"source not found: {path}\n"
            "Pass --source pointing at Unofficial Gay Fates' Paragon Imports/UGF.json"
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_pack(data: dict) -> tuple[list[dict], list[list[int]], dict]:
    supports = data.get("Services", {}).get("Supports", {})
    characters_module = data.get("Modules", {}).get("Characters", {})
    if not supports:
        fail("source has no Services.Supports section — is this the UGF export?")

    support_route: dict[str, int] = {}
    for pid, fields in characters_module.items():
        if isinstance(fields, dict) and "Support Route" in fields:
            support_route[pid] = int(fields["Support Route"])

    ids: set[str] = set(support_route)
    for left, partners in supports.items():
        ids.add(left)
        ids.update(partners.keys())

    ordered = sorted(ids)
    index = {pid: i for i, pid in enumerate(ordered)}

    characters = []
    for pid in ordered:
        entry: dict = {"id": pid, "name": pid[4:] if pid.startswith("PID_") else pid}
        if pid in support_route:
            entry["supportRoute"] = support_route[pid]
        if pid in CORRIN_IDS:
            entry["isCorrin"] = True
        characters.append(entry)

    seen: dict[tuple[int, int], int] = {}
    mismatches = 0
    for left, partners in supports.items():
        for right, fields in partners.items():
            if left == right:
                continue
            raw = int(fields.get("support_type", fields.get("type", 0)))
            a, b = sorted((index[left], index[right]))
            key = (a, b)
            if key in seen:
                if seen[key] != raw:
                    mismatches += 1
                continue
            seen[key] = raw

    edges = [[a, b, raw] for (a, b), raw in sorted(seen.items())]

    types = {raw for _, _, raw in edges}
    decoded = [decode_support_type(t) for t in types]
    romantic = sum(1 for d in decoded if d["kind"] == "romantic")
    fast = sum(1 for d in decoded if d["fast"])

    stats = {
        "characters": len(characters),
        "edges": len(edges),
        "distinctSupportTypes": len(types),
        "romanticTypes": romantic,
        "fastTypes": fast,
        "directionMismatches": mismatches,
    }
    return characters, edges, stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="path to UGF.json")
    parser.add_argument("--out", default=DEFAULT_PACK_DIR, help="pack output directory")
    args = parser.parse_args()

    source_path = os.path.abspath(args.source)
    data = load_source(source_path)
    characters, edges, stats = build_pack(data)

    os.makedirs(args.out, exist_ok=True)
    with open(source_path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()

    meta = {
        "id": "ugf-2.5.2",
        "label": "Unofficial Gay Fates 2.5.2 (installed build)",
        "status": "extracted",
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": {
            "file": os.path.basename(source_path),
            "sha256": sha256,
            "tool": "tools/extract/extract_ugf_supports.py",
        },
        "counts": {"characters": stats["characters"], "edges": stats["edges"]},
        "notes": [
            "Support type u32 = S<<24 | A<<16 | B<<8 | C point thresholds; 0xFF blocks a rank (platonic stores 0xFF for S).",
            f"distinct support types: {stats['distinctSupportTypes']} ({stats['romanticTypes']} romantic, {stats['fastTypes']} fast).",
            "Display names are raw PID suffixes until the English name map lands (docs/DATA.md).",
            "A+ (friendship) partners and child inheritance rules are not in this table; they land with the unit/class extraction.",
            "OPEN QUESTION: a few edges (e.g. Azura/Ryoma, Anna/Ryoma) carry S-capable types but have no conversation file in the mod's own 'Support Authors and Support Bin Names.txt'. Verify against the installed GameData before treating this table as final (docs/DATA.md).",
        ],
    }

    def write_json(name: str, payload) -> None:
        path = os.path.join(args.out, name)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"wrote {os.path.relpath(path, REPO_ROOT)}")

    write_json("characters.json", characters)
    write_json("supports.json", {"edges": edges})
    write_json("meta.json", meta)

    print(
        "done: {characters} characters, {edges} edges "
        "({warnings} direction mismatches ignored)".format(
            warnings=stats["directionMismatches"], **stats
        )
    )


if __name__ == "__main__":
    main()
