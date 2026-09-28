# Design

## Product

A **run planner** for a modded Fire Emblem Fates cartridge/emulator build. It answers, before and
during a playthrough: *who do I bring, who marries whom, what do their children become, and what
does it cost?* — under the rules the **mods actually installed** define, not vanilla Fates rules.

### Goals

1. **Mod-aware correctness.** UGF expands supports and marriages; free-renown/free-accessory mods
   remove economy gates. The planner must surface and enforce those realities, and must be able to
   switch to a vanilla profile without silently mixing datasets.
2. **Mobile-first, thumb-friendly.** Planning happens on a phone on the couch, not at a desk. One
   column, bottom tab bar, big tap targets, safe-area aware.
3. **Easy saves.** Never lose a plan: autosave, export/import JSON, share via URL.
4. **Zero backend.** Static hosting, no accounts, no tracking. Privacy and long-term linkability.

### Non-goals

- Combat/damage simulation, enemy AI, map planning.
- Redistributing any copyrighted game assets (no portraits, icons, audio — ever).
- Emulating the game; this is a notebook with correct math attached.

## Core concepts

| Concept | Meaning |
|---|---|
| **Plan** | One planned run: route, build profile, Corrin config, roster, seal budget, notes. |
| **Build profile** | Which game build rules apply (`ugf-2.5.2` installed, `vanilla` pending). Carries feature flags. Defined in `src/data/modProfiles.ts`. |
| **Dataset pack** | JSON bundle extracted from game/mod data: characters + support graph today, classes/skills/items later. Lazy-loaded per pack id. |
| **Support edge** | A pair (A,B) with a raw support type; decoded into romantic/platonic, fast/slow, and per-rank point thresholds. |
| **Mod flags** | Boolean features (expandedSupports, freeRenown, freeAccessories, voiceSelect, cosmeticTextures) that drive UI hints and, later, planning constraints. |

## Screens (current)

1. **Plan** — plan switcher and naming, build profile, route (accent re-tints the whole frame),
   Corrin card, roster, seal counters with mod flags.
2. **Supports** — searchable character list; per-character partner list split into Marriage /
   Platonic, rank availability (C/B/A/S dots), "Fast" supports, provenance footer.
3. **Reference** — build profile with mod breakdown (gameplay vs cosmetic, links), dataset status
   (counts, hash, notes), roadmap.
4. **Saves** — export/import backup, copy share link, new/delete plans, PWA install help.

Planned: **Inheritance** (parent pairings → child growths/caps/classes), **Classes** (reclass
chains, skills, stat projection), **Items** (accessories free under Tru's, forging budgets).

## Save model

- Zustand `persist` to `localStorage` key `fates-expanded-planner/v1`, `version: 1`.
- A plan: `{ id, name, route, buildProfileId, corrin, units[], seals, notes, createdAt, updatedAt }`.
- **Backups**: `exportBundle()` → `{ app, schema: 1, exportedAt, plans[] }`; import merges by plan
  id (replace semantics), never deletes what is already there.
- **Sharing**: `lz-string` compresses one plan into `#plan=…`; the app imports it on load if the id
  is not already present. The hash is stripped afterwards so refresh does not re-import.

Breaking a shape requires: bump `version`, add a `migrate`, bump bundle `schema`.

## Roadmap

| Phase | Content | State |
|---|---|---|
| 0 | Repo, shell, saves, build profiles, support graph | ✅ this scaffold |
| 1 | Unit/class/skill/item datasets from the modded GameData | next |
| 2 | Reclass chains, skills per unit, stat/growth projection | |
| 3 | Marriage planner + child inheritance math (UGF rules) | |
| 4 | Route-aware availability, resources (renown/seals/gold) | |
| 5 | Polish: install banner, accessibility pass, print/export view | |

## Design language

Ink-navy "war table" backdrop with parchment text and gold rules; the route accent
(Birthright crimson / Conquest violet / Valla teal) re-tints the entire frame. Display type is
Cinzel, body is Alegreya Sans. Motion is limited to a single staggered rise on screen change,
disabled under `prefers-reduced-motion`. All visuals are CSS — no image assets to license.
