# Fates Expanded Planner

A mobile-first **army planner** for a modded Fire Emblem Fates playthrough.

Plan the run: who's in the army, who marries whom, which classes everyone uses, the skills they
equip, and — for second-gen units — who their parents are and what growths they end up with.
Stats, growths, class sets and skills are read from the game's own data tables, so the numbers are
real; supports come from the installed **Unofficial Gay Fates** build, so the pairing rules are the
expanded ones, not vanilla's.

**Live:** <https://gr8pesodart.github.io/fates-expanded-planner/>

## What it does

- **Runs** — multiple saves with an obvious run switcher, route (Birthright / Conquest /
  Revelation) and a per-run **game build** dropdown (which mods are installed).
- **Corrin** — gender, boon/bane (real growth & cap effects), and a talent branch that also feeds
  into Kana's class pool.
- **Roster** — build the army from the full 71-unit dataset with English names; every unit has a
  detail page.
- **Classes** — pick any class the unit can actually reclass into: own branches, parents' branches
  (second gen), and Partner/Friendship Seal branches once supports are set.
- **Stats** — live stats / growths / caps tables per unit and chosen class, with Corrin boons and
  child-parent averaging applied (Fates formulas).
- **Skills** — equip up to five from the pool the unit can genuinely learn (personal skill + every
  class in their pool), each labelled with its source and level.
- **Supports & children** — set S and A+ ranks from the UGF graph; the planner shows the children a
  pair produces, and the Pairings tab tracks mutual pairs, one-sided mistakes and who's unpaired.
- **Children** — pick the second parent and watch growths average and cap modifiers combine;
  parent branches join the class pool automatically.
- **Reference** — browse all 71 units, 129 classes and 229 skills with full stat tables.
- **Saves that stick** — autosave to the device, JSON export/import backup, shareable links, and
  installable PWA (add to home screen, works offline).

## Stack

Vite 8 · React 19 · TypeScript · Zustand (persisted) · vite-plugin-pwa · lz-string · oxlint.
No backend, no accounts, no tracking — static hosting only.

## Development

```bash
npm install
npm run dev       # dev server
npm run lint      # oxlint
npm run build     # typecheck + production build (PWA)
```

Regenerate the data packs after a mod/build change (see [docs/DATA.md](docs/DATA.md)):

```bash
python tools/extract/extract_ugf_supports.py   # support graph (UGF Paragon export)
python tools/extract/extract_game_data.py      # units/classes/skills (GameData tables)
```

## Repository layout

```
src/
  data/           types, build profiles, boons, dataset loader, packs/
  logic/          class pools, stat/child projection, skill pools, family links
  state/          plans store (zustand persist, schema v2)
  screens/        Army (+ unit detail) / Supports / Reference / Saves
  lib/            ids, share-link codec
docs/
  DESIGN.md       product scope, screens, save model, roadmap
  MODS.md         what the installed mod build changes
  DATA.md         data pipeline: extraction, verification notes
  REFERENCES.md   prior art and credits
tools/
  extract/        Python extraction scripts (stdlib + fe_tools)
  icons/          PWA icon generator
```

## Data & credits

- Unit/class/skill tables are extracted from the vanilla `GameData.bin` using table layouts
  documented by [RainThunder's fefates-tools](https://github.com/RainThunder/fefates-tools);
  English names come from its enum lists. The installed build's UGF changes do not alter stats.
- The support graph is extracted from UGF's own Paragon export.
- Child-growth and class-inheritance rules follow Fates mechanics, cross-checked against
  community calculators (see [docs/REFERENCES.md](docs/REFERENCES.md)).
- No copyrighted art, audio or text is bundled. Fan-made; not affiliated with Nintendo or
  Intelligent Systems.
