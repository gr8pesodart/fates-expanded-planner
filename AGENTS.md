# AGENTS.md — working notes for this repo

Mobile-first **army planner** for a modded FE Fates build: roster, supports/pairings, classes,
skills, class routes, pair-up and second-gen parent/growth planning.

**v3 overhaul in progress** (Figma redesign: Roster · Chart · Runs + Character page). Read, in
order: [docs/design/SPEC.md](docs/design/SPEC.md) (visual + interaction source of truth, Figma
`bT3rsrSL9exw83MYWzMF73`), [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) › v3 (milestones, done-criteria),
[docs/VISION.md](docs/VISION.md) (product direction; its screen list is superseded by SPEC), then
[docs/DATA.md](docs/DATA.md) before touching data and [docs/MODS.md](docs/MODS.md) before changing mod
assumptions. `docs/design/reference.html` and the v1/v2 UIs are **not** design references.

## Commands

```bash
npm install
npm run dev          # vite dev server (localhost:5173)
npm run lint         # oxlint — must stay clean
npm run build        # tsc -b && vite build — must stay clean
npm test             # vitest — data spot-checks, logic, asset manifest coverage

python tools/extract/extract_game_data.py       # units/classes/skills from GameData + messages
python tools/extract/extract_ugf_supports.py    # support graph from UGF's Paragon export
python tools/assets/extract_assets.py           # sprites/icons/faces -> public/assets + manifest
```

## Ground rules

- **The product is army planning, not data plumbing.** The UI shows game content (units, classes,
  skills, pairings). Datasets/provenance talk belongs in docs, not screens. The only mod-list
  surface is the per-run **game build** dropdown.
- **Mod-aware by default.** Support rules come from the installed build's graph. Feature flags
  live in `src/data/modProfiles.ts`.
- **Official sprites, sourced properly.** Class sprites (body + unit head, stitched), skill icons and
  talk portraits come from the owner's own romfs dump via `tools/assets/`. Splash/promo art is the
  one set sourced online (owner-approved, v3); every file's source is logged in `docs/ASSETS.md`.
  Never take assets from the reference planners. No audio, no full textures/models. Everything
  must still render with `VITE_ASSETS=off` (monogram placeholders). Data packs hold factual game
  data with provenance in `meta.json`.
- **Do not copy from other planners.** Marigold (closed), Athnir / soapy4159 / hiushi (no
  license) are references only — see docs/REFERENCES.md. Game mechanics are facts; implement them
  independently.
- **Design comes from `docs/design/SPEC.md`** (Figma). Colours only via the SPEC token table; every
  active/selected state uses the route accent (`--accent` / `--accent-strong`).
- Backend-free and static-host friendly: `localStorage` + JSON export + URL-hash share only.

## Critical context — the companion build

Data comes from the sibling modding workspace `../3ds-games/fe-fates/` (its `AGENTS.md` is the
authoritative build reference). Key paths:

| Path | What it is |
|---|---|
| `work/cia-extract/romfs/GameData/GameData.bin.lz` | Vanilla GameData — unit/class/skill tables (what `extract_game_data.py` reads). |
| `work/cia-extract/romfs/m/@E/GameData.bin.lz` | English message archive — skill names/descriptions (UTF-16 text archive). |
| `work/cia-extract/romfs/icon/Icon.bch.lz`, `unit/`, `face/` | Sprite/icon/portrait sources for `tools/assets/extract_assets.py`. |
| `work/merge/GameData.bin.lz` | The installed build's GameData (supports; not used for stats). |
| `work/mods/unofficial-gay-fates/.../Paragon Imports/UGF.json` | Support graph source. |
| `work/mods/unofficial-gay-fates/.../Support Authors and Support Bin Names.txt` | Conversation list for edge verification. |
| `tools/fe_tools/` | Python LZ13/BinArchive (imported by the extractors). |

Table layouts and English enum lists come from RainThunder's fefates-tools (cached under
`tools/extract/sources/`, gitignored). GameData offsets: characters `0xDF0`/152 bytes, classes
`0xEA10`/128 bytes, skills `0x12BBC`/32 bytes (resolved from the GameData header pointers at
runtime). Support type decode: `S<<24 | A<<16 | B<<8 | C` thresholds, `0xFF` = locked. Asset
format notes live in docs/ASSETS.md.

## Conventions

- TypeScript strict; `verbatimModuleSyntax` + `erasableSyntaxOnly` — use `import type`, no enums.
- No comments unless they explain *why* (data quirks, mechanic rules).
- Game rules live in `src/logic/` (pure functions, no React): class pools/inheritance
  (`classes.ts`), stat/child projection (`stats.ts`), skill pools (`skills.ts`), pair children
  (`family.ts`). Screens stay presentational.
- Styling: design tokens in `src/styles/tokens.css` (the SPEC token table);
  resets/typography and shell primitives in `src/styles/base.css`. Screens use those classes. No
  CSS framework. Route accent: set `data-route` on `.app`; use `var(--accent)` tokens.
- Routing: tiny hash router in `src/lib/router.ts` (v3: `#/roster`, `#/unit/:id/<tab>`, `#/chart`,
  `#/runs`, `#/runs/new`). No router library.
- Store: v3 moves to `schema: 4` (fresh localStorage key, no migration). Relationship writes are
  symmetric and owned by the store.
- Assets: `Sprite`/`AssetImage` resolves `kind` + game id through `src/data/assets.json`; missing
  entries and `VITE_ASSETS=off` fall back to monograms.

## Data packs

`src/data/packs/<id>/` holds `meta.json`, `characters.json`, `supports.json` (support graph),
`units.json`, `classes.json`, `skills.json` (game tables). Units carry `routes`, `dlc`, `fid` and
`supportBonuses`; classes carry `jid`, `dlc`, `pairUp` and `skillLearn`; skills carry
`description`, `icon` and `dlc`. The loader (`src/data/loader.ts`) lazy-imports each file so chunks
stay small; add new packs there + in `modProfiles.ts`. Never hand-edit generated pack files — fix
the extractor and rerun. The asset manifest (`src/data/assets.json`) is generated by
`tools/assets/extract_assets.py` (docs/ASSETS.md).

## Verification

Before calling anything done:

1. `npm run lint && npm run build && npm test` — all clean.
2. Browser at 390×844: shell renders with real sprites (unit faces, skill icons, class sprites);
   `VITE_ASSETS=off` renders monograms.
3. Spot-check data against known values: Ryoma growths `50/45/0/50/45/40/35/25`, Gunter
   `15/5/0/5/0/15/5/5`, Shiro `50/50/0/40/35/35/45/30`, sibling pairs platonic (Ryoma × Hinoka),
   Corrin fast supports `3/7/12/18`, Shiro × Camilla growths average; route availability edge
   cases (Yukimura/Gunter/Izana/Fuga); the eight DLC class families; Ryoma's pair-up support rows
   (`Spd / Str / Skl / Spd+2`). Tests in `src/data/*.test.ts` pin these.
4. Asset coverage ≥ 90% per set (manifest `coverage` + `src/data/assets.test.ts`).
