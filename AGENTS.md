# AGENTS.md — working notes for this repo

Mobile-first run planner for a **modded** FE Fates build. Read
[README.md](README.md) first, then [docs/DATA.md](docs/DATA.md) before touching data, and
[docs/MODS.md](docs/MODS.md) before changing mod assumptions.

## Commands

```bash
npm install
npm run dev          # vite dev server (localhost:5173)
npm run lint         # oxlint — must stay clean
npm run build        # tsc -b && vite build — must stay clean
python tools/extract/extract_ugf_supports.py   # regenerate support pack
```

## Ground rules

- **Mod-aware by default.** Anything that assumes vanilla Fates rules is a bug unless the plan's
  build profile is vanilla. Feature flags live in `src/data/modProfiles.ts`.
- **No copyrighted assets.** No portraits/textures/audio in the repo, ever. Data files contain
  factual game/mod data (ids, stats, support adjacency) with provenance in their `meta.json`.
- **Do not copy from other planners.** Marigold is closed source; Athnir's planner has no license.
  They are UX/architecture references only — see docs/REFERENCES.md.
- Keep the app backend-free and static-host friendly. Saves are `localStorage` + JSON export +
  URL-hash share; do not introduce accounts or server storage without an explicit ask.

## Critical context — the companion build

Everything data-related comes from the sibling modding workspace
`../3ds-games/fe-fates/` (a few directories up from this repo). Its `AGENTS.md` is the
authoritative reference for the build. Key paths:

| Path | What it is |
|---|---|
| `work/mods/unofficial-gay-fates/.../Paragon Imports/UGF.json` | Source of the extracted support pack (UTF-8, clean PIDs). |
| `work/mods/unofficial-gay-fates/.../Support Authors and Support Bin Names.txt` | Per-pair conversation list; cross-check for edge verification. |
| `work/merge/GameData.bin.lz` | The exact modded GameData the game runs (support table ground truth). |
| `work/cia-extract/romfs/GameData/GameData.bin.lz` | Clean vanilla GameData (for diffs / future vanilla pack). |
| `tools/fe_tools/` (in fe-fates) | Python LZ13 + BinArchive ports; reuse, don't re-derive. |
| `tools/_dl/paragon-src/Data/FE14/Types/*.yml` | Paragon schemas for GameData tables (units, jobs, items …). |

Support type decode (u32, high byte first): `S<<24 | A<<16 | B<<8 | C` point thresholds,
`0xFF` = rank locked. `0x140E0904` romantic, `0xFF0E0904` platonic, `0x120C0703` fast romantic.
TS implementation: `decodeSupportType` in `src/data/types.ts`.

## Conventions

- TypeScript strict; `verbatimModuleSyntax` and `erasableSyntaxOnly` are on — use `import type`,
  no enums (union types + const arrays instead).
- No comments unless they explain *why* (data quirks, build decisions); code should read clean.
- Screens are plain function components in `src/screens/`, sharing the CSS classes defined in
  `src/index.css` (design tokens + `.card`, `.chip`, `.btn`, `.seg`, `.rowitem` …). There is no
  CSS framework; keep it that way unless there is a strong reason.
- Route accent theme: set `data-route` on `.app` (`birthright` | `conquest` | `revelation`) and use
  `var(--accent)` / `var(--accent-soft)` / `var(--accent-line)` in styles.
- Plans are versioned (`plansStore` persist `version: 1`); any breaking shape change needs a
  `migrate` implementation and a bundle `schema` bump.

## Adding a dataset pack

1. Create `src/data/packs/<id>/` with `meta.json`, `characters.json`, `supports.json` following
   the shapes in `src/data/types.ts` (see the existing `ugf-2.5.2` pack).
2. Add a loader branch in `src/data/loader.ts` (lazy `import()` so it code-splits).
3. Register a build profile in `src/data/modProfiles.ts` pointing at the pack id.
4. Keep `meta.json` honest: source file, sha256, generation tool, counts, and any open questions.

## Verification

Before calling anything done:

1. `npm run lint && npm run build` — both clean.
2. Exercise the touched flow in the browser at a 390×844 viewport (mobile first).
3. For data changes: rerun the extractor and confirm counts in the app's Reference tab match
   `meta.json`; for support edits, spot check known pairs (siblings platonic, vanilla marriages
   romantic, Corrin fast, e.g. via the checks described in docs/DATA.md).
