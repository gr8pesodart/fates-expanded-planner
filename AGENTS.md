# AGENTS.md — working notes for this repo

Mobile-first **army planner** for a modded FE Fates build: roster, supports/pairings, classes,
skills, and second-gen parent/growth planning. Read [README.md](README.md) first,
[docs/DATA.md](docs/DATA.md) before touching data, and [docs/MODS.md](docs/MODS.md) before
changing mod assumptions.

## Commands

```bash
npm install
npm run dev          # vite dev server (localhost:5173)
npm run lint         # oxlint — must stay clean
npm run build        # tsc -b && vite build — must stay clean

python tools/extract/extract_game_data.py       # units/classes/skills from GameData
python tools/extract/extract_ugf_supports.py    # support graph from UGF's Paragon export
```

## Ground rules

- **The product is army planning, not data plumbing.** The UI shows game content (units, classes,
  skills, pairings). Datasets/provenance talk belongs in docs, not screens. The only mod-list
  surface is the per-run **game build** dropdown.
- **Mod-aware by default.** Support rules come from the installed build's graph. Feature flags
  live in `src/data/modProfiles.ts`.
- **No copyrighted assets.** No portraits/textures/audio, ever. Data packs hold factual game data
  with provenance in `meta.json`.
- **Do not copy from other planners.** Marigold (closed), Athnir / soapy4159 / hiushi (no
  license) are references only — see docs/REFERENCES.md. Game mechanics are facts; implement them
  independently.
- Backend-free and static-host friendly: `localStorage` + JSON export + URL-hash share only.

## Critical context — the companion build

Data comes from the sibling modding workspace `../3ds-games/fe-fates/` (its `AGENTS.md` is the
authoritative build reference). Key paths:

| Path | What it is |
|---|---|
| `work/cia-extract/romfs/GameData/GameData.bin.lz` | Vanilla GameData — unit/class/skill tables (what `extract_game_data.py` reads). |
| `work/merge/GameData.bin.lz` | The installed build's GameData (supports; not used for stats). |
| `work/mods/unofficial-gay-fates/.../Paragon Imports/UGF.json` | Support graph source. |
| `work/mods/unofficial-gay-fates/.../Support Authors and Support Bin Names.txt` | Conversation list for edge verification. |
| `tools/fe_tools/` | Python LZ13/BinArchive (imported by `extract_game_data.py`). |

Table layouts and English enum lists come from RainThunder's fefates-tools (cached under
`tools/extract/sources/`, gitignored). GameData offsets: characters `0xDF0`/152 bytes, classes
`0xEA10`/128 bytes. Support type decode: `S<<24 | A<<16 | B<<8 | C` thresholds, `0xFF` = locked.

## Conventions

- TypeScript strict; `verbatimModuleSyntax` + `erasableSyntaxOnly` — use `import type`, no enums.
- No comments unless they explain *why* (data quirks, mechanic rules).
- Game rules live in `src/logic/` (pure functions, no React): class pools/inheritance
  (`classes.ts`), stat/child projection (`stats.ts`), skill pools (`skills.ts`), pair children
  (`family.ts`). Screens stay presentational.
- Screens are function components in `src/screens/` using the CSS classes in `src/index.css`
  (`.card`, `.chip`, `.btn`, `.seg`, `.rowitem`, `.statgrid` …). No CSS framework.
- Route accent: set `data-route` on `.app`; use `var(--accent)` tokens.
- Store: `plansStore` persist `version: 2` (+ `merge` normalizer, `migrate` from v1). Breaking
  shape changes bump the version and bundle `schema` (currently 2).

## Data packs

`src/data/packs/<id>/` holds `meta.json`, `characters.json`, `supports.json` (support graph),
`units.json`, `classes.json`, `skills.json` (game tables). The loader (`src/data/loader.ts`)
lazy-imports each file so chunks stay small; add new packs there + in `modProfiles.ts`.
Never hand-edit generated pack files — fix the extractor and rerun.

## Verification

Before calling anything done:

1. `npm run lint && npm run build` — both clean.
2. Browser at 390×844: add a unit, pick a class, check growths vs personal+class math, equip five
   skills, set S ranks, open a child and select a second parent.
3. Spot-check data against known values: Ryoma growths `50/45/0/50/45/40/35/25`, Gunter
   `15/5/0/5/0/15/5/5`, Shiro base `50/50/0/40/35/35/45/30`, sibling pairs platonic (Ryoma ×
   Hinoka), Corrin supports fast (`3/7/12/18`), Shiro × Camilla growths average.
