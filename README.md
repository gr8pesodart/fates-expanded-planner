# Fates Expanded Planner

A mobile-first run planner for a **modded** Fire Emblem Fates playthrough.

Most Fates planners assume vanilla rules. This one is built around the mods actually installed
in the [fe-fates build](../3ds-games/fe-fates/AGENTS.md) — above all **Unofficial Gay Fates**,
which expands the support graph to near-universal coverage (same-sex S supports, new conversation
sets, sibling/child support additions) — plus the free-renown and free-accessory mods that remove
grind gates. Plans should reflect what the expanded game actually allows, not vanilla limits.

**Status:** early scaffold. The support graph is live and extracted from the installed UGF build;
the run/roster/save flow works. Classes, skills, inheritance projection and route availability are
next (see the roadmap in [docs/DESIGN.md](docs/DESIGN.md)).

## Features today

- **Runs with saves** — multiple plans, autosaved to `localStorage`, JSON export/import backup,
  and shareable plan links (compressed into the URL hash).
- **Build-aware** — every plan targets a game build profile (`UGF 2.5.2 installed` or `vanilla`);
  mod flags (free renown, free accessories, expanded supports) come from the build.
- **Corrin setup** — gender, boon/bane, name; talent/voice arrive with the class dataset.
- **Roster planning** — add any of the 70 support-bearing characters from the extracted dataset.
- **Support graph browser** — for any character, see every UGF support partner, whether it can
  reach S, whether it is "fast", and the point thresholds per rank (C/B/A/S). Sibling and platonic
  pairs cap at A.
- **Installable PWA** — add to home screen on iOS/Android; works offline after first load.

## Stack

Vite 8 · React 19 · TypeScript · Zustand (persisted) · vite-plugin-pwa · lz-string · oxlint.
No backend: all data is static, all state is local. Deployable to GitHub Pages out of the box.

## Development

```bash
npm install
npm run dev       # dev server
npm run lint      # oxlint
npm run build     # typecheck + production build (PWA)
npm run preview   # serve the production build
```

Regenerate the support data pack after updating the mod or the extractor:

```bash
python tools/extract/extract_ugf_supports.py
python tools/icons/make_icons.py        # only needed if the sigil changes
```

## Repository layout

```
src/
  data/           types, build profiles, dataset loader, packs/
    packs/        extracted JSON packs (see docs/DATA.md)
  state/          plans store (zustand persist)
  screens/        Plan / Supports / Reference / Saves
  lib/            ids, share-link codec
  components/     icons and shared bits
docs/
  DESIGN.md       product scope, screens, save model, roadmap
  MODS.md         what the installed mod build changes (and why it matters)
  DATA.md         data pipeline: extraction, formats, verification notes
  REFERENCES.md   prior art and credits
tools/
  extract/        Python extraction scripts (stdlib only)
  icons/          PWA icon generator (Pillow)
```

## Deploying

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`. The build uses a
relative base, so it also works on any static host (Netlify, Cloudflare Pages, `npx serve dist`).

## Notes on data

The support pack is extracted from the Paragon export shipped inside the UGF download
(`Paragon Imports/UGF.json`) — it is data about a mod for a game you own, not redistributed game
content. Some edges still need verification against the installed `GameData.bin.lz`; see the trust
notes in [docs/DATA.md](docs/DATA.md). No copyrighted artwork is bundled: there are no portraits
or icons in this repo.

Fan-made tool. Not affiliated with Nintendo or Intelligent Systems. Fire Emblem Fates and all
associated artwork and text are trademarks of their respective owners.
