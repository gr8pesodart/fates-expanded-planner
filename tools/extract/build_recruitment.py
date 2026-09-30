#!/usr/bin/env python3
"""Build the per-route recruitment pack from the hand-curated source.

Source: tools/extract/curated/recruitment.source.json (one entry per unit per
route, with citations). This script validates every entry against the pack's
own units.json/classes.json, sorts each route by chapterSortKey (stable, so
same-key units keep the source's in-game join order) and writes
src/data/packs/ugf-2.5.2/recruitment.json.

Usage (from the repo root):

    python tools/extract/build_recruitment.py

The English class name in the source is gendered at build time: an exact match
wins, otherwise the unit's " (M)"/" (F)" variant is used.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_SOURCE = os.path.join(REPO_ROOT, "tools", "extract", "curated", "recruitment.source.json")
DEFAULT_PACK_DIR = os.path.join(REPO_ROOT, "src", "data", "packs", "ugf-2.5.2")

ROUTES = ("birthright", "conquest", "revelation")


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def load_json(path: str) -> dict:
    if not os.path.isfile(path):
        fail(f"file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class Validator:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, where: str, msg: str) -> None:
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}")


def resolve_class(name: str, gender: str, classes: list[dict], where: str, v: Validator) -> dict | None:
    exact = [c for c in classes if c["name"] == name]
    if len(exact) == 1:
        return exact[0]
    suffix = " (M)" if gender == "male" else " (F)"
    variant = [c for c in classes if c["name"] == name + suffix]
    if len(variant) == 1:
        return variant[0]
    if len(exact) > 1:
        v.error(where, f"joinClass '{name}' is ambiguous in classes.json")
    else:
        v.error(where, f"joinClass '{name}' does not resolve (also tried '{name + suffix}')")
    return None


def validate_entry(entry: dict, route: str, index: int, units: dict[str, dict], classes: list[dict], v: Validator) -> dict:
    where = f"{route}[{index}]"
    for key in ("unit", "name", "chapter", "chapterSortKey", "joinLevel", "joinClass", "promotedAtJoin", "optional", "notes", "cite"):
        if key not in entry:
            fail(f"{where}: missing key '{key}'")

    unit_id = entry["unit"]
    unit = units.get(unit_id)
    if unit is None:
        fail(f"{where}: unit '{unit_id}' ({entry['name']}) is not in units.json")

    if route not in unit["routes"]:
        v.warn(where, f"{entry['name']} ({unit_id}) is not listed for '{route}' in units.json routes {unit['routes']}")

    if not isinstance(entry["chapterSortKey"], (int, float)) or isinstance(entry["chapterSortKey"], bool):
        fail(f"{where}: chapterSortKey must be a number")
    if not isinstance(entry["joinLevel"], int) or isinstance(entry["joinLevel"], bool) or not 1 <= entry["joinLevel"] <= 40:
        fail(f"{where}: joinLevel must be an int in 1..40")
    if not isinstance(entry["optional"], bool) or not isinstance(entry["promotedAtJoin"], bool):
        fail(f"{where}: optional/promotedAtJoin must be booleans")
    if not str(entry["cite"]).startswith("http"):
        fail(f"{where}: cite must be a URL")

    cls = resolve_class(entry["joinClass"], unit["gender"], classes, where, v)
    if cls is None:
        return {}

    is_promoted = cls["tier"] == "promoted"
    if is_promoted != entry["promotedAtJoin"]:
        v.error(where, f"promotedAtJoin={entry['promotedAtJoin']} but {cls['name']} is tier '{cls['tier']}'")

    pool = set(unit["classes"]) | set(unit["reclasses"])
    if cls["id"] not in pool:
        v.warn(where, f"{entry['name']}'s join class {cls['name']} is not in the unit's class pool")

    row = {
        "unit": unit_id,
        "order": 0,
        "chapter": entry["chapter"],
        "joinLevel": entry["joinLevel"],
        "joinClassId": cls["id"],
        "optional": entry["optional"],
    }
    # Jakob/Felicia: the retainer of Corrin's own gender joins after Chapter 15 instead.
    late = entry.get("lateIfCorrin")
    if late is not None:
        for key in ("gender", "chapter", "chapterSortKey", "joinLevel"):
            if key not in late:
                fail(f"{where}: lateIfCorrin is missing '{key}'")
        if late["gender"] not in ("male", "female"):
            fail(f"{where}: lateIfCorrin.gender must be male or female")
        row["_late"] = late
    return row


def build(source: dict, units_data: dict, classes_data: dict, v: Validator) -> dict:
    units = {u["id"]: u for u in units_data["units"]}
    classes = classes_data["classes"]

    routes_in = source.get("routes", {})
    missing = [r for r in ROUTES if r not in routes_in]
    if missing:
        fail(f"source is missing routes: {', '.join(missing)}")

    out_routes: dict[str, list[dict]] = {}
    for route in ROUTES:
        entries = routes_in[route]
        seen: set[str] = set()
        built: list[tuple[float, dict]] = []
        for index, entry in enumerate(entries):
            row = validate_entry(entry, route, index, units, classes, v)
            if entry["unit"] in seen:
                fail(f"{route}: duplicate unit {entry['unit']}")
            seen.add(entry["unit"])
            built.append((entry["chapterSortKey"], row))
        built.sort(key=lambda pair: pair[0])
        for order, (_, row) in enumerate(built):
            row["order"] = order
        for _, row in built:
            late = row.pop("_late", None)
            if late is None:
                continue
            # Slot in after every unit sorting at or before the late key (fractional, so the
            # default orders of everyone else stay untouched).
            before = [other["order"] for key, other in built if other is not row and key <= late["chapterSortKey"]]
            row["ifCorrin"] = {
                late["gender"]: {
                    "order": (max(before) if before else -1) + 0.5,
                    "chapter": late["chapter"],
                    "joinLevel": late["joinLevel"],
                }
            }
        out_routes[route] = [row for _, row in built]

    return {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": source.get("meta", {}).get("sources", []),
            "counts": {route: len(out_routes[route]) for route in ROUTES},
        },
        "routes": out_routes,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="path to recruitment.source.json")
    parser.add_argument("--pack", default=DEFAULT_PACK_DIR, help="pack directory with units.json/classes.json")
    parser.add_argument("--out", default=DEFAULT_PACK_DIR, help="output pack directory")
    args = parser.parse_args()

    source = load_json(args.source)
    units_data = load_json(os.path.join(args.pack, "units.json"))
    classes_data = load_json(os.path.join(args.pack, "classes.json"))

    v = Validator()
    pack = build(source, units_data, classes_data, v)

    for warning in v.warnings:
        print(f"warning: {warning}")
    for error in v.errors:
        print(f"error: {error}", file=sys.stderr)
    if v.errors:
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, "recruitment.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(pack, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    counts = pack["meta"]["counts"]
    print(f"wrote {os.path.relpath(path, REPO_ROOT)}")
    print("done: " + ", ".join(f"{route} {counts[route]}" for route in ROUTES) + f" ({len(v.warnings)} warnings)")


if __name__ == "__main__":
    main()
