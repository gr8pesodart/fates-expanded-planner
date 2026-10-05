# References & credits

Prior art this project learns from. **None of their code or data is copied here** — where a
resource has no license (Athnir) or is closed source (Marigold), it is treated strictly as a UX
and architecture reference. Game data is extracted from the owner's own game/mod files.

## Planners

- **Athnir — Fire Emblem Fates Unit Planner** — <https://github.com/Athnir/Fire-Emblem-Fates-Unit-Planner>
  (live: <https://athnir.github.io/Fire-Emblem-Fates-Unit-Planner/>). Open-source TypeScript/Vite
  PWA covering vanilla marriage, pair-up, class/skill builds and inheritance. Closest architecture
  reference: `data/` modules + `logic/` calculators + zustand stores + backup/export. **No license
  file** — do not copy code or data; feature parity target and structural inspiration only.
- **Marigold — Fire Emblem Team Planners** — <https://marigoldfe.com/>. Closed source; the best
  vanilla Fates UX reference (Planner / Inheritance / Units / Classes / Skills / Items tabs, share
  team, per-route pages). We borrow interaction ideas, not assets or code.
- **soapy4159 — Fates Calculator (ferevpairings)** — <https://soapy4159.github.io/ferevpairings/>
  (source: <https://github.com/soapy4159/ferevpairings>, **no license**). Pairing/child calculator:
  bases, growths, cap mods, pair-up, class inheritance. Used as a mechanics cross-check (child
  growth averaging and cap-mod combination) — values were verified
  against it, nothing was copied.
- **hiushi — FE14 Stuff** — <https://hiushi.github.io/FE14Stuff/> (repo has no content). “Build
  planner + charts” UX inspiration for the unit/class/skill surfaces.

## Tooling & formats

- **RainThunder — fefates-tools** — <https://github.com/RainThunder/fefates-tools>. Nightmare
  modules for FE Fates. **Actively used**: its table documentation (character/class field layouts)
  and ID→name enum lists let `tools/extract/extract_game_data.py` read the user's own GameData
  file. The lists are fetched at extraction time into a gitignored cache; generated packs record
  provenance. This is the project's only significant third-party data dependency.
- **Paragon** (thane98) — <https://github.com/thane98/paragon>. FE data editor. Used here for its
  FE14 table schemas (`Data/FE14/Types/*.yml`) and as the authoring format of the UGF export that
  feeds our support pack. Local copy: `fe-fates/tools/_dl/paragon-src`.
- **mila** (thane98) — <https://github.com/thane98/mila>. BinArchive / LZ13 reference; the
  `fe_tools` Python ports in the fe-fates workspace are based on it.
- **FEFTwiddler** — <https://github.com/Soaprman/FEFTwiddler>. Save editor; conceptual reference
  for unit/class data shapes. Local copy: `fe-fates/tools/_dl/FEFTwiddler-0.18.1`.
- **CTRTool / 3dstool / makerom** — CIA/NCCH extraction and rebuilding, used by the companion
  build. See `fe-fates/AGENTS.md`.

## Game data & mods

- **Unofficial Gay Fates** — <https://gamebanana.com/mods/51420>. The installed build's core
  gameplay mod; support graph extracted from its Paragon export.
- Other installed mods (Free Renown Rewards, Tru's Accessory Shop, Unit Select Voice, Texture
  Compilation, Furry Fates, Dragon-Hare Corrin): see [docs/MODS.md](MODS.md) for links and effects.
- **Companion build workspace** — `../3ds-games/fe-fates/` (`AGENTS.md`, `inbox/mod-list.md`,
  `tools/mod-manifest.json`). The authoritative record of how the patched CIA was built and every
  mod decision (including what was excluded and why).

## Legal notes

- Fan-made project; not affiliated with Nintendo or Intelligent Systems.
- No copyrighted art, audio or text is bundled. Data files carry provenance in their `meta.json`.
- If a reference project later gains a license, re-evaluate what can be reused — until then,
  clean-room implementations only.
