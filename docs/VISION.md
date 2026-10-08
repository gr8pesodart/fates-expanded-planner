# Vision — Fates Expanded Planner

> **v3 (2026-09-29):** the screens and look are now defined by the owner's Figma design, captured in
> [design/SPEC.md](design/SPEC.md): **Roster · Chart · Runs** plus a per-unit Character page
> (Avatar / Profile / Stats / Progression). The *journey* and *lens* sections below describe the v2
> layout and are superseded wherever they disagree with SPEC. Principles, mechanics, assets policy
> (plus online splash art) and success criteria still apply.

> v2 is a **ground-up rebuild**. The v1 app (tag `v1-final`, branch `main` before the rebuild) is a
> *data* reference only: its extractors, data packs and `src/logic/` mechanics may be reused after
> review. Its screens, layout, styling and information architecture must **not** inform v2.
> Visual direction lives in [`docs/design/reference.html`](design/reference.html).

## One sentence

A pretty, fast, thumb-friendly Fire Emblem Fates army planner that takes you from *"which mods am I
playing?"* to *"here is my whole army, married, classed, skilled and paired up for combat"* — with
every number computed live from the game's own tables and the installed mod's support rules.

## Why another planner

| Reference | What it gets right | What it misses (our opening) |
|---|---|---|
| **soapy4159 — ferevpairings** | Streamlined, feature-dense pairing design: one screen, many decisions, instant child math | Not pretty, not mobile friendly, **ignores growths** |
| **hiushi — FE14Stuff** | In-depth per-character capability analysis, skill selection, official assets, solid class reference | No **per-character stat analysis**, no **class route planning**, no **multi-character overview** with the chosen options up top |
| **v1 of this repo** | Real extracted data, UGF support graph, correct child/cap/class-pool math | Generic UI; no route planning, pair-up, preview |

v2 = soapy's density for pairings + hiushi's depth per character + growth-aware maths everywhere +
class route planning + a read-only formation preview — on a phone.

Both references are **look-don't-copy** (no licenses). Mechanics are facts; implement them
independently. Never pull assets or data from their repos.

## Principles

1. **Decisions first.** Every screen answers "what do I pick?" Reference data appears *in service of*
   a decision (e.g. growths shown next to the partner you are choosing), never as a wall of tables.
2. **Live maths.** Change a pairing anywhere → every dependent number (child growths, caps, class
   pool, skill pool, pair-up bonus) updates everywhere, instantly.
3. **Glanceable, then granular.** Roster views compare many units at low detail; the individual
   view goes deep on one. Tap to drill, swipe/back to return — the same unit is never more than two
   taps away.
4. **Mobile-first, desktop-generous.** Designed at 390×844; at ≥1024px panels sit side by side
   (list + detail), never a stretched phone.
5. **Mod-aware.** The modpack chosen at setup decides who can support/marry whom, how fast, and any
   stat/class changes. Never hard-code vanilla pairing limits.
6. **Official look, factual data.** Class, skill and character sprites come from the owner's own game
   dump (see *Assets*). Data comes from extracted tables with provenance.
7. **Static & private.** No backend. `localStorage`, JSON export/import, URL-hash share links, PWA.

## The user journey

The app has two top-level areas — **Setup** and **Roster** — and the Roster has three lenses:
**Pairings**, **Individual**, **Preview**. A persistent header shows the active run, modpack, DLC
state and route, and the lens switcher.

### 1. Setup

A short, friendly first-run flow (also reachable later from the header).

- **Modpack** — select the build (e.g. *Vanilla*, *Unofficial Gay Fates 2.5.2*). Determines the
  support graph (who can S/A+, marriage vs platonic, support speed) and any stat/class changes.
  Switching a modpack on an existing run warns about pairings that become invalid and lists them.
- **DLC** — one toggle per content-providing DLC map (v3.5): Anna on the Run (Anna), the class-item
  maps (Dread Fighter, Dark Falcon, Ballistician, Witch, Lodestar, Vanguard, Great Lord, Grandmaster),
  the skill-book maps (Heirs of Fate, End: Lost in the Waves, the Gift maps) and the Japan-only
  festival maps. Each gates what its map hands out: units, class-change items and so their classes,
  and skill books. Off = hide them from every pool; plans that use them show a warning chip instead of
  silently breaking. Experience/gold/illustration/weapon maps add nothing to plan with and have no
  toggle.
- **Route** — Birthright / Conquest / Revelation. Filters unit availability (route availability must be
  extracted or curated with sources) and personal-skill-per-route where it differs.
- **Run** — name it; multiple runs with a quick switcher; duplicate / delete / export / import / share.

### 2. Roster — Pairings lens (the "soapy" screen, made beautiful)

Purpose: compare everyone at a high-level glance, then commit relationships.

- **Unit grid / list** of all available units: sprite, name, personal skill icon, primary/secondary
  class chips, a compact **growth sparkline** (8 stats) and **cap-modifier pips** (+/−).
- **Compare mode**: pin 2–4 units → side-by-side growths, cap mods, the class each would **offer a
  partner** (Partner Seal / Friendship Seal branch), personal skills, and — for a candidate pair —
  the resulting **child preview** (growths, caps, class pool).
- **Define relationships**: S partner (marriage / S support) and A+ partner per unit, filtered and
  badged by the modpack's graph (romantic / platonic / fast / locked). Conflicts are loud: one-sided
  picks, a unit claimed twice, a child whose variable parent is unset.
- **Children** appear inline under their parents once a pair produces them (fixed parent + variable
  parent), with their averaged growths.
- **Define Corrin**: gender, boon, bane (with live growth/cap effect), talent class, and Corrin's
  spouse. Kana appears automatically with Corrin's pairing.
- **Filter/sort** by growth in a stat, class type (physical/magic), availability, unpaired, etc.

### 3. Roster — Individual lens (the "hiushi" screen, but deeper)

Purpose: granular planning for one unit. Everything reacts to that unit's relationships, which can
be edited here too (a relationship strip at the top), so "what if Shiro's mum were Oboro?" is
one tap.

- **Header**: sprite, name, current planned class, relationship strip (S partner, A+ partner, parents
  for children, combat partner + role).
- **Class options**: every class in the unit's pool, grouped by source (own, parent, Partner Seal,
  Friendship Seal, talent, DLC). Each card shows **total growths** (personal + class, or averaged
  for children), **caps** (class caps + cap mods), and class skills — compare two classes
  side by side.
- **Stats**: bases, growths, caps, and **projected average stats** at a chosen level along the
  planned route. Pair-up bonuses shown as a separate delta layer (see Mechanics), for both roles.
- **Skill planner**: five equip slots. The pool = personal skill + class skills across the pool,
  each tagged with where/when it is learned (class + level) and whether the current route reaches it.
  Picking a skill that the route doesn't reach offers to add the class stop to the route.
- **Class route planner**: an ordered timeline of class stops — `class, level range, seal used to get
  there` — that computes which skills are acquired at each step, validates seal/level rules (base
  vs promoted, Heart / Partner / Friendship / Master / Eternal / Offspring seals, level resets on
  promotion, level carry on reclass), and flags unreachable skills or illegal transitions.
- **Inheritance** (children): which skill each parent passes down (last equipped skill of the
  parent — verify rule) and the inherited classes.
- **Combat pair-up**: choose in-combat partner and default role (**front / lead** or **back /
  support**). Show the pair-up bonus the partner provides at the pair's support rank.

### 4. Roster — Preview lens (read-only)

Purpose: a clean reference to keep open while playing. No editing controls, no non-decision data.

- Toggle from the header; everything collapses to **permanent decisions**: S partners, A+ partners,
  children and their variable parent, Corrin's boon/bane/talent, and inherited skills. Optionally the
  final planned class and five skills (decisions, but not permanent — shown lighter).
- **Grouped by combat pair-up**: each group is a front/back duo (front on top/left), then solo units.
  Units with no combat partner sit in an "unassigned" group.
- Shareable as-is (share link opens straight into Preview) and printable.

## Mechanics the app must get right

Implement in pure functions under `src/logic/` with unit tests. Where a rule is marked *verify*,
confirm against the game data or a well-sourced community reference (Serenes Forest mechanics
pages) and note the source in `docs/DATA.md`.

- **Stats**: displayed base = personal base offsets + class bases; growths = personal + class;
  caps = class caps + personal cap mods (HP exempt). Corrin boon/bane modify growths, bases and caps.
- **Children**: growths = floor((child personal + variable parent personal) / 2) — *verify*; cap
  mods = fixed + variable parent mods (+1 when the variable parent is not a child); inherit the
  variable parent's class branch; starting level/bases depend on chapter/paralogue timing — out of
  scope unless cheap.
- **Class pools**: own primary/secondary; parents' branches for children; Partner Seal (S partner's
  branch) and Friendship Seal (A+ partner's branch); duplicate fallbacks; gender-locked classes
  resolved to the right variant; Songstress/Nohr Prince(ss)/Kitsune/Wolfskin/Villager special cases.
- **Skills**: learn levels 1/10 (base), 5/15 (promoted), special classes 1/10/25/35; personal skill
  always; five equip slots; DLC classes' skills gated by the DLC toggle.
- **Class route**: base classes cap at 20, promoted at 20, special at 40; promotion resets to 1;
  reclassing base↔base keeps level; promoted→base conversion rules (*verify*); Eternal Seal raises
  the cap by 5 per seal.
- **Pair-up**: backup unit grants its class's pair-up stat bonuses plus support-rank bonuses to the
  lead (*verify* the exact per-rank table); guard-meter/dual-strike are display-only notes.
- **Supports**: rank thresholds from the modpack's support type (`S<<24|A<<16|B<<8|C`, `0xFF` =
  locked), romantic vs platonic, fast supports.

## Assets

Official art makes the app feel like Fates. Source it **from the owner's own game dump**
(`../3ds-games/fe-fates/work/cia-extract/romfs/` — `icon/`, `face/`, `unit/`), converted to web PNG /
WebP by a script under `tools/assets/`, with a manifest mapping game IDs → files and recording
provenance. Fallback sources (e.g. The Spriters Resource, Serenes Forest) only if extraction is
impractical for a given set — record each source in `docs/ASSETS.md`. Never pull from the reference
planners' repos.

Needed sets: **class sprites** (map/menu sprite per class & gender), **skill icons**, **character
sprites/portraits** (small face icon per unit; full portrait optional). Weapon-type icons are a bonus.

Assets are fan-use of Nintendo/Intelligent Systems property: the app carries a clear
"fan-made, not affiliated" notice, and assets live in one folder so they can be removed or swapped
for placeholders with a single build flag (`VITE_ASSETS=off` → monogram placeholders).

## Non-goals

Combat/damage simulator, map/chapter planner, save-file editing, accounts or cloud sync, a
dataset-provenance UI (provenance lives in docs), and any second mod beyond what a pack describes.

## Success criteria

- A new user sets up a Revelation UGF run with DLC on, marries 20+ pairs, and sees a finished Preview
  in under 10 minutes on a phone.
- Every growth/cap/pair-up number shown matches a hand calculation from the tables.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95. First load < 250 KB JS gzip (assets lazy).
- The Preview reads clearly on a 390px screen with 30+ units.
