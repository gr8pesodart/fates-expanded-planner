# Fates Expanded Planner

A mobile-first **army planner** for a modded Fire Emblem Fates playthrough: roster, supports and
pairings, classes, skills, class routes, pair-up and second-gen parent/growth planning. Projections
use the game's data tables and the installed build's support graph; documented approximations are
listed below and in `docs/DATA.md`.

> **v2 integrated build on branch `v2`.** Setup, Pairings, Individual, Class Route and read-only
> Preview are wired to the persisted plan store. The v1 UI (tag `v1-final`) is not a design
> reference — see [docs/VISION.md](docs/VISION.md) and [docs/design/reference.html](docs/design/reference.html).

## Current state

- **Setup and runs** — select the installed UGF build, DLC and route; persist multiple plans in
  `localStorage`; rename, duplicate, delete, import/export JSON and copy share links.
- **Pairings** — search and compare roster units; edit S/A+ relationships and Corrin; derive child
  growths, offered classes and inherited-parent choices from the selected pairings.
- **Individual and Class Route** — review class pools, growths, caps, projected stats and pair-up
  deltas; plan five skills; edit combat partner/role; add class stops and validate seal/level rules.
- **Preview** — shareable, read-only reference grouped by combat duos, solos and unassigned units;
  permanent choices stay prominent, and planned classes/skills are de-emphasised.
- **Data** — 71 unit definitions, 129 classes, 229 skills and 2,463 UGF 2.5.2 support edges.
  Vanilla gameplay data is pending and that option is disabled in Setup.
- **Assets** — official class sprites, skill icons and unit face icons extracted from the owner's
  own romfs dump into `public/assets/` (1.3 MB total) with a generated manifest
  (`src/data/assets.json`); coverage: skills 100%, units 100%, classes 96.9%. `VITE_ASSETS=off`
  swaps everything for monogram placeholders.

### Data limitations

- A+ partner options currently use same-gender A-rank supports as an approximation.
- The plan schema records final S/A+ decisions, not current support rank. Pair-up math infers
  S/A+ from those choices and otherwise uses C rank; B rank cannot be selected.
- Child support-bonus rows are empty in the extracted table, and inherited skill timing/order still
  needs an in-game mechanics check. See [docs/DATA.md](docs/DATA.md) for the full list.

## Commands

```bash
npm install
npm run dev          # vite dev server (localhost:5173)
npm run lint         # oxlint — must stay clean
npm run build        # tsc -b && vite build — must stay clean
npm test             # vitest run (data spot-checks + logic + asset manifest)
```

Regenerate data packs and assets after a mod/build change (see [docs/DATA.md](docs/DATA.md) and
[docs/ASSETS.md](docs/ASSETS.md)):

```bash
python tools/extract/extract_ugf_supports.py     # support graph (UGF Paragon export)
python tools/extract/extract_game_data.py        # units/classes/skills (GameData + messages)
python tools/assets/extract_assets.py            # class sprites / skill icons / face icons
```

## Repository layout

```
src/
  components/     Sprite/AssetImage (official asset + monogram fallback)
  data/           types, packs/, loader, assets.json manifest + resolver, mod profiles, boons
  lib/            hash router, id helpers
  logic/          class pools, stat/child projection, skill pools, family links (pure functions)
  screens/        Setup, Pairings, Individual, Class Route and Preview
  state/          schema 3 local plan store, import/export and share serialization
  viewmodels/     real-data hooks that feed presentational screens
  styles/         tokens.css (design contract) + base.css
docs/
  VISION.md       product direction
  BUILD_PLAN.md   milestones and roles
  DATA.md         data pipeline: extraction, sources, verification notes
  ASSETS.md       asset pipeline: sources, decoders, coverage
  MODS.md         what the installed mod build changes
  REFERENCES.md   prior art and credits
  design/         visual reference (source of truth for tokens/components)
tools/
  extract/        Python extraction scripts (stdlib + fe_tools)
  assets/         Python asset decoders + extraction script
```

## Data & credits

- Unit/class/skill tables are extracted from the vanilla `GameData.bin` using table layouts
  documented by [RainThunder's fefates-tools](https://github.com/RainThunder/fefates-tools);
  English names come from its enum lists, skill descriptions from the game's own message archive.
  The installed build's UGF changes do not alter stats.
- The support graph is extracted from UGF's own Paragon export.
- Child-growth, pair-up and class-inheritance rules follow Fates mechanics, cross-checked against
  community sources (see [docs/DATA.md](docs/DATA.md), [docs/REFERENCES.md](docs/REFERENCES.md)).
- Sprites, icons and portraits are fan-use assets extracted from the **owner's own game dump**
  (no data from other planners); the app is fan-made and not affiliated with Nintendo or
  Intelligent Systems.
