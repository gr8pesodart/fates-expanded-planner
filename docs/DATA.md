# Data pipeline

Everything the planner knows comes from **the exact build being played** — the modded workspace at
`../3ds-games/fe-fates/` plus the game's own tables. This document records what is extracted, how,
and what is still open.

## What's in the packs

| Data | State |
|---|---|
| Support graph (UGF: who supports whom, marriage vs platonic, speed, thresholds) | ✅ `supports.json` |
| Units (71 playables: English names, bases, growths, cap mods, class sets, personal skills) | ✅ `units.json` |
| Classes (129: growths, caps, pair-up, class skills, promotions, movement) | ✅ `classes.json` |
| Skills (229 names) | ✅ `skills.json` |
| Child rules (fixed parents, growth averaging, cap-mod combination, class inheritance) | ✅ in `src/logic/` |
| A+ (friendship) exact partner tables | ⚠️ approximated (same-gender A-rank partners) |
| Route availability per unit | ⏳ not extracted; route selector is cosmetic for now |
| Skill descriptions | ⏳ not extracted (names only) |

## Support pack — `tools/extract/extract_ugf_supports.py`

**Source:** `work/mods/unofficial-gay-fates/.../Paragon Imports/UGF.json` (the mod author's own
Paragon export, UTF-8, clean PIDs). Writes `characters.json` (71) and `supports.json` (2,463
pairs, raw type ints). Decode: `S<<24 | A<<16 | B<<8 | C` point thresholds; `0xFF` locks a rank.
`0x140E0904` romantic, `0xFF0E0904` platonic, `0x120C0703` fast romantic, `0xFF0C0703` fast
platonic. Decoding lives in `src/data/types.ts`.

Regenerate: `python tools/extract/extract_ugf_supports.py`.

## Unit/class/skill packs — `tools/extract/extract_game_data.py`

**Source:** vanilla `work/cia-extract/romfs/GameData/GameData.bin.lz`, decompressed with
`fe-fates/tools/fe_tools/lz13.py`. Table layouts and ID→name lists come from RainThunder's
[fefates-tools](https://github.com/RainThunder/fefates-tools) Nightmare modules (enum lists are
cached in `tools/extract/sources/`, gitignored; the script downloads them if missing).

Table offsets (absolute in the decompressed file):

| Table | Offset | Entry | Fields used |
|---|---|---|---|
| Characters | `0xDF0` | 255 × 152 | name ptr (+8), gender flag (byte 0), support route (+38), classes (+44/+46), level cap (+134), bases (+56), growths (+64), cap mods (+72), weapon ranks (+96), skills (~+104), personal skills per route (+116/118/120), reclass options (+124/126), fixed parent cid (+42) |
| Classes | `0xEA10` | 129 × 128 | name ptr (+16), bases (+28), growths (+36), caps (+52), pair-up (+60), weapon ranks (+68), class skills (+84…90), movement (+93), promotions (+100/+102), base classes (+104/+106) |

Notes:

- Strings resolve at `pointer + 0x20` (BinArchive data-space offset), Shift-JIS. Character name
  strings are `PID_<japanese name>` — the same key space as the support pack, so joins are exact.
- Vanilla tables are used deliberately: the installed build's UGF changes touch supports only, not
  unit stats/classes (docs/MODS.md). The merged GameData relocates later tables, so don't read
  class data from it without re-locating.
- English names are slot/index lookups into RainThunder's lists; the game itself stores Japanese
  internal names.
- Growths/stats/caps were cross-validated against a community calculator's published values
  (Shiro, Asugi, Selkie, Ryoma, Gunter all match exactly).

Regenerate: `python tools/extract/extract_game_data.py` (needs the fe-fates workspace; override
paths with `--gamedata`, `--fe-tools`, `--sources`).

## Mechanics implemented (src/logic)

- `classes.ts` — class families, gendered variants, branch chains, and the class-pool rules:
  - first gen: own primary branch + secondary branch
  - second gen: own branch + fixed parent's primary branch + variable parent's primary branch
  - everyone: Partner Seal (S) and Friendship Seal (A+) branches
  - duplicates fall back to the contributor's next branch; Songstress never inherits; Nohr
    Prince(ss)/Wolfskin/Kitsune/Villager can only come from parents (not seals)
  - Corrin's chosen talent joins Corrin's pool and Kana's pool
- `stats.ts` — `stats = personal bases + class bases`; `growths = personal + class` (personal
  includes boon/bane for Corrin); `caps = class caps + personal cap mods` (HP exempt); children:
  `growths = floor((child + variable parent) / 2)`, `cap mods = fixed + variable (+1 unless the
  variable parent is a child)`.
- `skills.ts` — learnable pool with source labels; levels 1/10 (base), 5/15 (promoted),
  1/10/25/35 (special); five equip slots.
- `family.ts` — children of a pair: units whose fixed parent is either partner (Corrin couples
  produce Kana plus the spouse's child).

## Verification & open questions

Cross-checks already performed:

- Shiro/Asugi/Selkie/Ryoma/Gunter growths and cap mods match community data exactly.
- Sibling pairs platonic (Ryoma × Hinoka), vanilla marriages romantic (Ryoma × Rinkah).
- Corrin supports fast (`3/7/12/18`); UGF additions (Camilla × Hinoka, Rinkah × Hana) confirmed in
  the mod's `Support Authors and Support Bin Names.txt`.

Open questions (see also docs/REFERENCES.md):

1. **Overstated support edges?** A few S-capable pairs in the UGF export have no conversation file
   in the mod's own list (e.g. Azura × Ryoma, Anna × Ryoma). Resolve by exporting the *installed*
   `work/merge/GameData.bin.lz` with Paragon (or parsing the support table directly) and diffing.
2. **Same-sex children.** UGF grants same-sex S supports; the planner allows any romantic partner
   as a second parent. Verify in-game whether same-sex couples recruit children, and narrow the
   candidate list if not.
3. **A+ partners.** Exact per-character A+ lists are not in the extracted data; the UI approximates
   with same-gender A-rank partners.
4. **Route availability.** Roster filtering by route is not implemented yet (data not extracted).
5. **Skill descriptions.** Names only, for now.

## Pack format (v1)

- `characters.json` — `[{ id, name, supportRoute?, isCorrin? }]` (support-pack order = edge indexes)
- `supports.json` — `{ edges: [[a, b, rawType]] }`
- `units.json` / `classes.json` / `skills.json` — `{ meta, units|classes|skills }`
- `meta.json` — pack provenance for the support graph (the game-data packs carry their own `meta`)

The loader (`src/data/loader.ts`) resolves ids, decodes types, and builds lookup maps; all files
are lazy `import()`s so they arrive as separate chunks.
