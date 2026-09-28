# Data pipeline

Everything the planner knows about the game comes from **the exact build being played** — the
modded workspace at `../3ds-games/fe-fates/` — never from a random spreadsheet. This document
records what is extracted today, how, the open questions, and the plan for the rest.

## What the planner needs

| Data | State |
|---|---|
| Support graph (who supports whom, marriage vs platonic, speed, point thresholds) | ✅ extracted (`ugf-2.5.2` pack) |
| Characters (ids, display names, route availability, gender, child links) | ◐ ids + raw names exist; English names, route/gender/child links pending |
| Classes (promotion trees, skill lists, caps, pair-up bonuses) | ⏳ from modded GameData |
| Skills (names, descriptions, class/level source) | ⏳ |
| Items/accessories (catalog, prices — Tru's shop is free) | ⏳ |
| Child inheritance rules (growths, caps, class sets, fixed vs variable parents) | ⏳ formulas are known; parents come from the unit dataset |
| A+ (friendship) partners | ⏳ not in the support table; separate data |

## The extracted support pack

**Source:** `work/mods/unofficial-gay-fates/Unofficial Gay Fates v2.5.2/Paragon Imports/UGF.json`
inside the fe-fates workspace. It is the mod author's Paragon project export (UTF-8, clean PIDs),
i.e. the data they used to build the modded `GameData.bin.lz`.

**Extractor:** `tools/extract/extract_ugf_supports.py` (Python stdlib only). It reads
`Services.Supports` (pid → partner pid → `support_type`) and `Modules.Characters`
(`Support Route`), dedupes pair rows (0 direction mismatches as of 2.5.2), and writes a compact
pack to `src/data/packs/ugf-2.5.2/`:

```
characters.json   [ { id, name, supportRoute?, isCorrin? } ]      # 71 entries
supports.json     { edges: [ [aIndex, bIndex, rawType], ... ] }   # 2,463 pairs
meta.json         provenance: source sha256, tool, counts, notes
```

Edges store **raw** type ints; decoding happens in `decodeSupportType` (`src/data/types.ts`) so
the rules live in one place. The tuple indexes point into `characters.json`, keeping the pack
small (~48 KB) and the network payload lazy-loaded.

**Regenerate:** `python tools/extract/extract_ugf_supports.py` from the repo root. The script
prints character/edge counts; the app's Reference tab shows the same numbers from `meta.json`.

### Support type decode

Raw u32, high byte first: `S<<24 | A<<16 | B<<8 | C` point thresholds; `0xFF` locks a rank.

| Raw | Kind | Speed | C/B/A/S |
|---|---|---|---|
| `0x140E0904` | Romantic | normal | 4 / 9 / 14 / 20 |
| `0xFF0E0904` | Platonic (A max) | normal | 4 / 9 / 14 / — |
| `0x120C0703` | Romantic | fast | 3 / 7 / 12 / 18 |
| `0xFF0C0703` | Platonic | fast | 3 / 7 / 12 / — |

## Verification

Cross-checks already performed against known Fates rules (reproduce by loading the pack and
looking up the pairs):

- Sibling pairs are platonic: Ryoma×Hinoka, Xander×Camilla → no S.
- Vanilla marriages are romantic: Ryoma×Rinkah, Xander×Charlotte → S available.
- Corrin support speed: Corrin(F)×Ryoma → fast thresholds (3/7/12/18).
- UGF additions confirmed in the mod's own `Support Authors and Support Bin Names.txt`:
  Camilla×Hinoka, Rinkah×Hana have conversation files.

### Open questions (do not skip these before shipping pairing features)

1. **Overstated edges?** A few pairs carry S-capable types in the export but have *no conversation
   file* in the mod's own list (e.g. Azura×Ryoma, Anna×Ryoma, which are A-only in vanilla). Either
   UGF grants "silent" S ranks, the authors list is incomplete, or the author's project file has
   draft rows. **Resolution:** export the *installed* `work/merge/GameData.bin.lz` with Paragon
   (or parse the supports table directly — see below) and diff against this pack edge-by-edge;
   also spot check in-game if possible.
2. **Route restrictions.** `Support Route` values (5/6/7) from `Modules.Characters` are stored raw
   but not decoded. Route-specific conversation archives use 白/黒/透 prefixes; availability may be
   conversation-driven rather than table-driven.
3. **A+ partners** are not in the supports table; they need separate extraction or a curated list.
4. **English names.** Display names are currently the PID suffix (Japanese). A mapping table is
   needed (community list or text extraction from the USA build's message archives).

## Extracting the rest (planned)

The modded `GameData.bin.lz` the game actually runs is at
`fe-fates/work/merge/GameData.bin.lz`; the clean vanilla file is at
`fe-fates/work/cia-extract/romfs/GameData/GameData.bin.lz`. Two viable routes, in order of
effort:

1. **Paragon round-trip (recommended first).** Load the clean CIA in Paragon (GUI, from
   `fe-fates/tools/_dl/paragon-src`), export the modules we need; load the UGF build, export the
   same modules; diff → a vanilla pack plus mod deltas. Gives units, classes, skills, items and
   the real supports table with English field names from Paragon's FE14 schemas
   (`paragon-src/Data/FE14/Types/GameData.yml`, `Job.yml`, `Skill.yml`, `Item.yml`, plus
   `paragon/core/services/fe14_supports.py` for the supports model).
2. **Schema-driven parse.** Reuse `fe-fates/tools/fe_tools` (`lz13`, `binarchive`) plus the
   Paragon YAML schemas to read tables straight into JSON. More coding, fully scriptable,
   good long-term for regenerating after every rebuild.

Other references in the workspace worth knowing: `work/analysis/` holds per-mod GameData diffs
(vanilla vs UGF vs Free Battle); `tools/scripts/merge_gamedata.py` shows exactly which fields the
free-rewards mods zero (`Minimum BP/VP`, 160 values).

## Pack format spec (v1)

```jsonc
// meta.json
{
  "id": "ugf-2.5.2",
  "label": "Unofficial Gay Fates 2.5.2 (installed build)",
  "status": "extracted",           // or "pending" for empty placeholder packs
  "generatedAt": "2026-09-28T17:20:35Z",
  "source": { "file": "UGF.json", "sha256": "…", "tool": "tools/extract/extract_ugf_supports.py" },
  "counts": { "characters": 71, "edges": 2463 },
  "notes": ["…open questions and decode rules…"]
}
```

- `characters.json` — array of `CharacterDef` (`src/data/types.ts`).
- `supports.json` — `{ edges: [ [a, b, rawType] ] }`, indexes into the characters array.
- The loader (`src/data/loader.ts`) resolves ids, decodes types and builds the per-character edge
  index; add new packs there with a branch + lazy import.

## Re-running the numbers

```powershell
# regenerate the pack
python tools\extract\extract_ugf_supports.py

# quick pinned-pair sanity checks (see Verification above)
python - <<'PY'
import json, os
pack = os.path.join('src', 'data', 'packs', 'ugf-2.5.2')
chars = json.load(open(os.path.join(pack, 'characters.json'), encoding='utf-8'))
edges = json.load(open(os.path.join(pack, 'supports.json'), encoding='utf-8'))['edges']
idx = {c['name']: i for i, c in enumerate(chars)}
def show(x, y):
    a, b = sorted((idx[x], idx[y])); t = next(t for ea, eb, t in edges if (ea, eb) == (a, b))
    s = (t >> 24) & 0xFF
    print(x, 'x', y, '->', 'S' if s != 0xFF else 'A max', 'C/B/A/S =',
          t & 0xFF, (t >> 8) & 0xFF, (t >> 16) & 0xFF, s)
show('リョウマ', 'ヒノカ')      # siblings -> A max
show('リョウマ', 'リンカ')      # vanilla marriage -> S
show('プレイヤー女', 'リョウマ')  # Corrin -> fast (3/7/12/18)
PY
```
