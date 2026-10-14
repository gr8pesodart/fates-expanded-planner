#!/usr/bin/env python3
"""Check the support pack against the installed build's own GameData support table.

The pack is built from the Paragon `UGF.json` export (extract_ugf_supports.py). This reads the
support table straight out of GameData.bin.lz and diffs every (character, partner) type, so the
pack can be trusted to match what the game actually loads. Checked 2026-10-14: 0 differences
against work/merge/GameData.bin.lz and the UGF main/compat GameData files, and the table is
symmetric.

Table layout (decompressed file offsets; data starts at 0x20):
  u32 N, then N u32 pointers (data space) to per-character blocks.
  block = entries of 12 bytes: u16 flag/id, u16 field, u16 partner CID, u16 sequence, u32 type.
  The first entry's first two u16s are (block index, entry count) instead.
  A block's owner is the character whose record has that block index at record offset +48
  (character table at 0xDF0, 152-byte records, PID pointer at +8, CID at +36).
  type = S<<24 | A<<16 | B<<8 | C, 0xFF = locked (decoded in src/data/types.ts).

Usage: python tools/extract/verify_supports.py [--gamedata PATH] [--paragon PATH]
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(REPO, "..", "3ds-games", "fe-fates")
DEFAULT_GAMEDATA = os.path.join(FE, "work", "merge", "GameData.bin.lz")
DEFAULT_PARAGON = os.path.join(
    FE, "work", "mods", "unofficial-gay-fates", "Unofficial Gay Fates v2.5.2", "Paragon Imports", "UGF.json"
)
CHAR_OFF, CHAR_SIZE = 0xDF0, 152


def read_table(data: bytes) -> dict[str, dict[str, int]]:
    def string_at(ptr: int) -> str:
        end = data.index(b"\x00", ptr + 0x20)
        return data[ptr + 0x20 : end].decode("shift_jis", errors="replace")

    pid_of_cid: dict[int, str] = {}
    pid_of_block: dict[int, str] = {}
    for slot in range(160):
        rec = data[CHAR_OFF + slot * CHAR_SIZE : CHAR_OFF + (slot + 1) * CHAR_SIZE]
        try:
            pid = string_at(struct.unpack_from("<I", rec, 8)[0])
        except ValueError:
            break
        if not pid.startswith("PID_"):
            continue
        pid_of_cid[struct.unpack_from("<H", rec, 36)[0]] = pid
        pid_of_block.setdefault(struct.unpack_from("<H", rec, 48)[0], pid)

    for offset in range(0x100, len(data) - 8, 4):
        count = struct.unpack_from("<I", data, offset)[0]
        first = struct.unpack_from("<I", data, offset + 4)[0] + 0x20
        if not 30 <= count <= 100 or first + 12 > len(data):
            continue
        entries = struct.unpack_from("<H", data, first + 2)[0]
        if 20 <= entries <= 100 and data[first + 11] in (0x12, 0x14, 0xFF):
            break
    else:
        sys.exit("error: support table not found")

    table: dict[str, dict[str, int]] = {}
    for index in range(count):
        base = struct.unpack_from("<I", data, offset + 4 + 4 * index)[0] + 0x20
        entry_count = struct.unpack_from("<H", data, base + 2)[0]
        partners = {}
        for seq in range(entry_count):
            _, _, cid, got_seq, raw = struct.unpack_from("<HHHHI", data, base + 12 * seq)
            if got_seq != seq:
                sys.exit(f"error: unexpected entry sequence in block {index}")
            partners[pid_of_cid.get(cid, str(cid))] = raw
        table[pid_of_block.get(index, str(index))] = partners
    return table


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--gamedata", default=DEFAULT_GAMEDATA)
    parser.add_argument("--paragon", default=DEFAULT_PARAGON)
    args = parser.parse_args()

    sys.path.insert(0, os.path.join(FE, "tools"))
    from fe_tools import lz13  # noqa: E402

    with open(args.gamedata, "rb") as handle:
        game = read_table(lz13.decompress(handle.read()))
    with open(args.paragon, encoding="utf-8") as handle:
        source = json.load(handle)["Services"]["Supports"]
    paragon = {k: {p: v["support_type"] for p, v in partners.items()} for k, partners in source.items()}

    diffs = [
        (owner, partner, game.get(owner, {}).get(partner), paragon.get(owner, {}).get(partner))
        for owner in set(game) | set(paragon)
        for partner in set(game.get(owner, {})) | set(paragon.get(owner, {}))
        if game.get(owner, {}).get(partner) != paragon.get(owner, {}).get(partner)
    ]
    asymmetric = sum(1 for a in game for b, raw in game[a].items() if game.get(b, {}).get(a) != raw)
    print(f"characters {len(game)}, entries {sum(len(v) for v in game.values())}")
    print(f"differences vs Paragon export: {len(diffs)}; asymmetric pairs: {asymmetric}")
    for row in diffs[:20]:
        print("  ", row)
    sys.exit(1 if diffs or asymmetric else 0)


if __name__ == "__main__":
    main()
