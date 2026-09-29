# Fates Expanded Planner

A mobile-first **army planner** for a modded Fire Emblem Fates playthrough: roster, supports and
pairings, classes, skills, class routes, pair-up and second-gen parent/growth planning. Every number
is computed live from the game's own data tables and the installed mod build's support graph.

> **v2 rebuild in progress on branch `v2`.** The app shell, design tokens, data pipeline and asset
> pipeline are in place (Milestone 0); feature screens follow. The v1 UI (tag `v1-final`) is not a
> design reference — see [docs/VISION.md](docs/VISION.md) and
> [docs/design/reference.html](docs/design/reference.html).

## Current state (Milestone 0)

- **Scaffold** — Vite 8 · React 19 · TypeScript strict (`verbatimModuleSyntax`,
  `erasableSyntaxOnly`) · Zustand · tiny hash router · vite-plugin-pwa · oxlint · Vitest.
- **Design tokens** — transcribed from `docs/design/reference.html` into `src/styles/tokens.css`,
  with route accents (`[data-route]`) and night mode (`[data-theme="night"]`); self-hosted fonts.
- **App shell** — header (run pill, Setup entry), Pairings / Individual / Preview lens switcher and
  placeholder routes: `#/setup`, `#/pairings`, `#/unit/:id`, `#/unit/:id/route`, `#/preview`.
- **Data** — 71 units, 129 classes, 229 skills with descriptions, learn levels, DLC flags, route
  availability and per-unit pair-up support bonuses; 2,463 support edges from UGF 2.5.2.
- **Assets** — official class sprites, skill icons and unit face icons extracted from the owner's
  own romfs dump into `public/assets/` (1.3 MB total) with a generated manifest
  (`src/data/assets.json`); coverage: skills 100%, units 100%, classes 96.9%. `VITE_ASSETS=off`
  swaps everything for monogram placeholders.

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
  screens/        route placeholders (setup / pairings / unit / unit route / preview)
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
