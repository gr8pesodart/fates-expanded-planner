# Design

## Product

An **army planner** for a modded Fire Emblem Fates run: assemble the roster, assign supports and
marriages, choose each unit's classes and skills, and project second-gen units from their parents.
It answers, run by run: *who do I bring, who marries whom, what classes and skills do they use,
and what will the children look like?* — under the rules the installed mods define.

### Goals

1. **Army first.** Every screen exists to plan the roster: units, pairings, classes, skills, kids.
2. **Correct numbers.** Stats, growths, caps and class skills come from the game's tables; child
   averaging and cap-modifier rules follow Fates mechanics.
3. **Mod-aware.** Supports come from the installed build's graph (UGF's expanded pairings); the
   run's game build is a single dropdown.
4. **Mobile-first and saveable.** One column, thumb-sized controls, autosave, export/import,
   share links, installable PWA, no backend.

### Non-goals

- Combat/damage simulation, enemy AI, map planning.
- Redistributing copyrighted assets (no portraits, icons or audio — ever).
- Dataset/provenance UI. Sources live in docs; the app shows game content.

## Core concepts

| Concept | Meaning |
|---|---|
| **Run (plan)** | One playthrough: route, build, Corrin, roster, pairings. |
| **Build profile** | Which mods are installed (`ugf-2.5.2` or vanilla). One dropdown per run. |
| **Dataset pack** | Extracted game data: support graph + units/classes/skills. |
| **Class pool** | Every class a unit can legitimately use: own branches, parents' branches, seal branches. |
| **Skill pool** | Learnable skills: personal + class skills across the pool, source-labelled. |
| **Fixed / variable parent** | Second-gen units have one guaranteed parent and one chosen spouse. |

## Screens

1. **Army** — run switcher (chips, not a dropdown), run name/duplicate/delete, game build, route,
   Corrin card (boon/bane/talent), roster with search-add. Tapping a unit opens the **unit
   detail**: planned class (grouped by branch source), stats/growths/caps, skill equipping,
   S/A+ partner selection with child previews, and a parents card for second-gen units.
2. **Supports** — pairing overview for the run: mutual pairs with children, one-sided S ranks that
   need fixing, and unpaired units.
3. **Reference** — browse Units / Classes / Skills with full stat tables (unit bases, growths,
   cap mods, class sets; class growths, caps, pair-up, promotions, skills).
4. **Saves** — export/import backup, share link, new/delete.

## Save model

- Zustand `persist` to `localStorage` key `fates-expanded-planner/v1`, `version: 2`.
  The `merge` normalizer guarantees a Corrin roster entry on every rehydrate; `migrate` upgrades
  v1 plans (which tracked seal counters).
- A plan: `{ id, name, route, buildProfileId, corrin, units[], notes, createdAt, updatedAt }`
  where a unit is `{ id, characterId, classId?, skills[], sPartnerId?, aPlusPartnerId?,
  variableParentId? }`.
- **Backups**: `{ app, schema: 2, exportedAt, plans[] }`; imports merge by plan id.
- **Sharing**: one plan compressed into `#plan=…` via lz-string.

Breaking a shape requires: bump `version`, extend `migrate`, bump bundle `schema`.

## Mechanics encoded (documented in docs/DATA.md)

- Growths = personal + class. Corrin adds boon/bane. Children average the variable parent's
  personal growths: `floor((child + parent) / 2)`.
- Caps = class caps + personal cap modifiers (HP exempt); children combine both parents' mods
  (+1 when the variable parent is not itself a child).
- Class sets: first gen = own primary + secondary; second gen = own + fixed parent's primary +
  variable parent's primary, plus Partner (S) and Friendship (A+) seal branches. Songstress is
  never inherited; Nohr Prince(ss)/Wolfskin/Kitsune/Villager only come from parents/own set.
- A+ candidate lists are approximated as same-gender A-rank partners (the exact A+ table is not in
  the extracted data).

## Roadmap

| Phase | Content | State |
|---|---|---|
| 0 | Shell, saves, build profile, support graph | done |
| 1 | Units/classes/skills data + class, skill, stat and child planning | done (this pass) |
| 2 | Pair-up bonuses in stat views; A+ exact tables; route-aware rosters | next |
| 3 | Inheritance cross-checks (sibling/partner class conflicts), unit swap suggestions | |
| 4 | Polish: charts (growth-by-class comparisons), print/export view, install banner | |

## Design language

Ink-navy "war table" backdrop with parchment text and gold rules; the route accent
(Birthright crimson / Conquest violet / Valla teal) re-tints the entire frame. Display type is
Cinzel, body is Alegreya Sans. Motion is one staggered rise per screen, disabled under
`prefers-reduced-motion`. All visuals are CSS — no licensed assets.
