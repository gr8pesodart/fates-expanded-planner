# Build plan

## v3 — Figma overhaul (current)

Requested 2026-09-29. It replaces the v2 information architecture (Setup / Pairings / Individual /
Route / Preview lenses) with the owner's Figma design: **Roster · Chart · Runs** plus a Character
page (Avatar / Profile / Stats / Progression). Read [design/SPEC.md](design/SPEC.md) first; it is
the visual and interaction source of truth. `design/reference.html` and the v2 screenshots are
historical.

Branch **`v3`** off `v2` (tag `v2-final` first). Keep: data packs and extractors, `src/logic/`,
`src/state/serialization.ts`, the asset pipeline, and the view-model seam pattern (screens read typed
hooks and never import stores or fixtures). Replace: tokens, `base.css`/`components.css`,
`src/components/`, `src/screens/`, `src/viewmodels/`, `src/prototype/`, the router table.

### Progress (2026-09-30)

- Done on `v3`: spec + tokens; B1 recruitment (DS lane, merged), B2 lenses, B3 progression engine,
  B4 sort; C schema 4 store with symmetric relationships; D1–D6 all screens incl. Runs/new-run and
  desktop; A1 talk portraits (DS lane, merged); `npm run shots` → `docs/screenshots/v3/`.
- A2 stitched sprites merged (DS lane; Opus review fixed texture alpha → 4-layer draw-priority
  stack). **Awaiting owner sign-off** on `docs/screenshots/v3/sprites.png`.
- A3 splash art done directly after the DS lane stalled (see ASSETS.md › Splash art).
- v3.1 notes pass: sort sheet (stat sorts + icons, direction, favourites / pair-link toggles) on
  Roster and Chart independently; Mov column; sticky roster and character headers; Parents tab for
  children; mods checklist (UGF required); Conquest default; stat renames and dynamic colouring;
  one-way A+; Corrin Friendship Seal / talent inheritance; Nohr Prince(ss) route promotions; animated
  idle map sprites (game timing, paused offscreen and under reduced motion).

- PWA updates: the service worker uses `skipWaiting` + `clientsClaim`, and `src/app/pwa.ts`
  re-checks for a new build whenever the app returns to the foreground (and hourly), then reloads.
  iOS home-screen apps resume rather than relaunch, so without this they sat on old builds. Verified
  end to end (build A → rebuild → `visibilitychange` → page reloads onto build B).
- v3.1.1 / audit: Fates skill learning (one per level-up), recruitment-level field, two inherited
  skills per child, Corrin's planned A-rank (Friendship Seal) set, fixes from validating the v3.1 pass.
- v3.2 (live 2026-10-01): pair-up Mov decoded; children's pair-up rows; route-locked Nobles;
  Jakob/Felicia order by Corrin gender; mobile character layer (no pop after swipe-back); swipe +
  slide between Roster lenses and character tabs; reworked sticky header; relationship open buttons,
  Corrin A-rank grid, family links; Parents page per Figma 15:1542; sprite head/body load sync and
  whole-number scaling; Chart sticky header. Agent knowledge captured in `.claude/skills/` (see
  AGENTS.md).
- v3.3 (branch `v3`, 2026-10-01, owner notes "fe fates planner v3.3"): per-gender Corrin (schema 5
  with schema-4 migration; inactive Corrin keeps its plan, stale partners greyed), Corrin name,
  boon/bane swap; character tabs as one always-mounted swipe strip (48px / flick commit, 380ms),
  slow slide-in on open, splash cross-fade on gender switch; sticky class-stat rail; class
  favourites (Profile + Stats); skill access groups (In / Not in progression, Inheritable only, Not
  accessible) driving the new skill picker, Profile skill notices (Figma 3:4348) and two Progression
  sections; recruitment skills under the join line, "Learns" dropped; Roster Expected Final Stats
  lens; Chart tabs (Full / Skills / Progression / Skills + Pair Up). Pickers and Runs are lazy chunks
  (main chunk back under 500 kB). Skill icons stay native (no usable higher-res set — docs/ASSETS.md).
  Corrin hair colour (30 swatches) and inherited hair on map sprites (grey hair strips + runtime
  overlay tint). Follow-up notes: Jakob/Felicia level cap 40, heart for roster favourites, per-child
  parent favourites, integer-scaled skill icons, compact inheritable notices in the picker.
  Skill access now covers relationship combinations (duplicate-branch fallbacks), checked by
  `npm run audit:skills`; picker notices sit under the class headings. Corrin's hair swatches come
  from the ROM (`MyUnitEdit.bin` colour table); sprite animations share one clock at native
  loop lengths (same-length loops in sync). Skill picker v2: Starred / Grouped / Ungrouped tabs, stars, S / A+ filters, Requires
  relationship + Not accessible groups, classes listed whole (shared skills under each class).
- v3.4 (branch `v3`, 2026-10-02, owner notes "3.4 notes"): skill picker on the shared `TabPager`
  (tabs kept mounted, each scrolling on its own), per-character S / A+ filters plus "Parent
  flexible", Grouped table-of-contents pill rail (no sticky headings), parent sprites and
  "Skills can (only / also) be inherited from" wording, gender-merged parent classes, other-parent
  inheritance under Inheritable only, faded Requires support / Not accessible heads, grey cards for
  not accessible skills, "Equipped" label above the description, star centred beside it (outline no
  longer clipped). Notice tones blue / yellow / red (`--info` tokens); class + level moved into an
  accent tag under every description. Stat Takers: muted rule + red conflict notice. Gendered class
  names (Monk/Shrine Maiden etc.) now swap by gender in every pool (was a bug). Inline personal-skill
  lock. Chart: tab swipes (same pager), sprite-only left shift. Inherit picker lists the parent's
  equipped skills first. Rails: pill colours tween, one sliding underline for tab rails; character
  tab pills tween and scroll into view. Roster stat tables slide off the page edge, not the row.
  Follow-ups: standard-case card labels, chart sprites back on the inset, every parent sprite on
  Inheritable only heads, `--rel-a` / `--info-soft` moved onto the `--info` hue (OKLCH 264.7),
  inherit picker as one list under the sticky pill rail (In / Not in the parent's progression, no tabs
  or stars),
  children's inherited picks listed on the parent's Progression when its path doesn't teach them.
  Round 3: automate progression (seal-budgeted search, Eternal Seal prompt), Seals Used tally with
  Icon Project item icons (new `extract_item_icons.py`), skill books as a DLC way in, Azura back to
  Songstress, Roster lens strip (neighbour lenses pre-rendered), sprites paused while sliding,
  inherit picker's equipped skills first on green.
  Round 4: solver pruning (Pareto dominance on known-skill bitmasks, set-cover and level bounds,
  Eternal floor first; hard DLC cases 127 s → ~1.3 s) and a Web Worker; class-or-book question;
  equipped skills off the path assumed from their skill book and counted; seals pill with tooltip;
  Eternal Seal buttons side by side.
  Round 5: children's recruitment chapter (level table, earliest = later parent), Offspring Seal as a
  join-row promotion, automation plans with it and asks when skipping it is cheaper.
  Round 6: merged main's seal pill work (SealTally, run-wide Chart pill); owner's priority list
  (focus weapons incl. a weapon picker, Str/Mag then Spd/Def/Res growth); per-save item limits and
  real crest names from item research; unobtainable skill books dropped.
  Round 7: "levels in the selected class" priority; book and Offspring routes planned side by side
  in a "Choose a route" sheet; Festival of Bonds DLC switch (New Run + run menu, with a DLC switch
  there too); `--t-note` token; equal-width sheet buttons.
  Round 8 (2026-10-03, branch `opus`): branches cut to `main` / `opus` / `deepseek` (two agents in
  parallel). Swipe lag fixed at the cause (sprite pausing hadn't): the drag wrote `--swipe-dx` on the
  swipe surface and every descendant restyled each pointermove; now an inline `translate` on the
  tracks only, own layer while dragging, Web Animation release; TabPager without inherited variables;
  Roster strips reuse tables across lens changes; one shared IntersectionObserver for sprites.
  `scripts/swipe-profile.mjs` measures it (4x CPU: drag 53-81 → ~17-19 ms/frame).
  Release feel: a velocity-matched critically damped spring (`lib/spring.ts`) starting the moment the
  finger lifts, handed over to the new page by shared `startTime`; React's update deferred a frame so
  it can't hold the page still; Chart tabs memoised (the release stutter there).
  Round 9 (2026-10-04, branch `opus`): talk-portrait **hair colour** on every portrait (runtime
  overlay tint of the game's colour table over the extracted hair layer; soft outline alpha kept -
  the first tint drew a hard black ring); default expressions fixed (entry names now come from the
  archive's label table - the stored pointer read two entries off, so Jakob, Anna, Peri, Orochi,
  Hana and others shipped 苦 / 笑); chips 128 → 108 px, cards 248 → 196 px; the character hero is
  the talk portrait zoomed on FaceData's face rect (critical cut-ins were tried first and dropped -
  the 2:1 art didn't fit the box), linear route gradient light on the right, black overlay 0.94 →
  0.6; Corrin (F) portraits and fallback faces switched to build 2 (map sprite unchanged - the game
  reuses one head for both builds); cut-in assets deleted (portraits 2.5 MB → 910 KB).

### Backlog

- **Roster name clipping (iOS, unconfirmed fixed):** owner saw names clipped at the right edge, worse
  further down. Not reproducible in desktop Chromium/WebKit; `content-visibility: auto` was removed
  from rows as the likely cause (Safari repaint bugs) and the name got glyph-overhang padding. Ask the
  owner whether it persists.
- **Splash load speed:** reported slow even when cached; measured 1–9 ms from cache on desktop. Needs
  an on-device report (first open vs relaunch) before more work.

- **Directional map animations** (walk cycles): the ROM has eight-direction move clips alongside
  idle (docs/assets/overworld-animation-audit.md); v3.1 ships idle only to keep strips small.

### A — Assets (gated; do first, in parallel with B)

1. **Talk portraits.** Extend `tools/assets/extract_assets.py` to decode `face/face/<name>_st.arc`
   (neutral expression, hair merged exactly like the `_bu` faces). Emit one WebP per unit plus two
   crop boxes in the manifest: `face` (square) and `bust` (about 3:4). Corrin M/F default faces.
   Coverage ≥ 90%.
2. **Stitched map sprites (spike, then build).** `unit/Body/<class>/anime.bin` is a BinArchive of
   per-frame records: body cell, head cell, and a signed head offset (e.g. `0xfe` = −2). Decode it,
   extract frame 0 of each body sheet and of each `unit/Head/<unit>/青0.bch.lz`, and write
   `sprites.json` = `{ bodies: {classId: {file, w, h, head: {x, y}}}, heads: {unitId: {file, w, h}},
   unique: {…} }`. Handle `unit/Unique/` bodies (Velouria, Keaton, Kana dragon…), generic heads
   for units without their own, and gendered bodies. `ClassSprite` composes body + head at runtime.
   **Gate:** a contact sheet (`docs/screenshots/v3/sprites.png`) of 12 unit×class combos, compared
   against in-game captures, signed off by the owner before the screens depend on it.
3. **Splash art.** Official Fates promo art for every unit plus Corrin M/F, sourced online
   (Fire Emblem Wiki / Serenes Forest galleries). Log every file's source URL and licence note in
   `docs/ASSETS.md`. Convert to WebP ≤ 900px tall. `splash.json` holds a focal point per unit
   (`{x, y}` in 0–1) so the header crops on the face. `VITE_ASSETS=off` falls back to a route-hue
   gradient.
4. UI icons: port `docs/design/figma/icons/*.svg` to `src/components/icons/` as `currentColor`
   components, and add `mdi:sort-alphabetical-ascending` and `mdi:sort-numeric-descending`.

### B — Data and logic

1. **Recruitment** (curated, sourced): per route, the recruit order index, join chapter, join level
   and join class for every unit; children get their paralogue. Store it in
   `src/data/packs/<id>/recruitment.json` generated from a curated source file under
   `tools/extract/curated/` with citations (Serenes Forest recruitment pages). Test Yukimura, Gunter,
   Izana and Fuga availability, and Birthright vs Conquest order for Kaze/Jakob/Felicia.
2. **Lenses** `src/logic/lenses.ts`: the nine lenses in SPEC › Stats as pure functions
   `(dataset, run, unitId, classId?) → StatRow` where a cell is `number | null` (null renders `-`).
   Reuse `stats.ts` (child averaging, cap mods, boon/bane) and `pairUp.ts`.
3. **Progression engine** `src/logic/progression.ts`: from the start class/level and the list of
   reclass picks `{ segment, level, classId }`, derive segments (Base / Advanced / Special / Eternal
   extensions), per-level class, skills learned per level, valid reclass options per level,
   expected average stats per level (growth accumulation with class-cap clamping), and the effective
   growth / pair-up at each level. Reuse `classRoute.ts` rules. Tests: Corrin Nohr Princess → Samurai
   @10 → Swordmaster @12 → Master of Arms @A15 matches the mock's skills (Dragon Fang, Duelist's
   Blow, Vantage, Astra, Swordfaire…); an illegal promotion is not offered.
4. **Sort** `src/logic/rosterSort.ts` (done, tested): optional favourites first → chosen sort
   (recruit / name / any stat incl. Mov, ascending or descending) → recruit order tiebreak; children
   trail first-gen only under recruit order; a stat sort on a `-` column resets to recruit order.
   Optional pair linking lifts the lower-ranked partner up to the higher one, front unit first.
   Recruitment data must give optional recruits (Mozu, Izana, Fuga…) the index of their chapter.

### C — State (`schema: 4`, fresh key; v2 was never released, so no migration)

`RunPlan` gains `favourites: string[]`. `UnitPlan` keeps `sPartner`, `aPlusPartner`,
`variableParent`, `classId`, `skills`, `inheritSkill`, `combatPartner` and `combatRole`, and
replaces `classRoute` with `reclasses: { segment: number; level: number; classId: number }[]`.
Relationship writes are **symmetric** (S both ways, pair-up partner and roles both ways,
child "Parent B" ↔ parent's S); v3.1 makes A+ a one-way choice (docs/DATA.md › v3 planner rules).
The store owns that, with tests. UI state (non-persisted, or persisted separately): roster lens,
Roster and Chart sorts (independent), open info panel.

### D — Screens (after A-gate for sprites; portraits/splash can use monograms until ready)

1. Tokens + base CSS + shared components from SPEC › Shared components (StatTable, StatLensRail,
   Segmented, PortraitChip, RelationSlot, ClassSprite, SkillCard, BottomNav, Sheet/Popover).
2. Roster + sort sheet + class popup + character picker.
3. Character page: header/tabs, Profile (+ skill picker), Stats, Avatar, Progression.
4. Chart. 5. Runs + new-run setup flow. 6. Desktop layouts (SPEC › Desktop).

Routes: `#/roster`, `#/unit/:id/(avatar|profile|stats|progression)`, `#/chart`, `#/runs`,
`#/runs/new`, and a share link that opens `#/chart` read-only.

### Done when

- `npm run lint && npm run build && npm test` are clean. The AGENTS.md spot-checks still pass, plus
  new tests for lenses, progression, recruitment and symmetric relationships.
- Screenshots at 390×844 of every Figma frame's state are saved next to the Figma render in
  `docs/screenshots/v3/` and reviewed side by side. The same screens at 1280×800 too.
- Journeys: new Revelation run → Corrin boon Spd/bane Lck → S Corrin×Anna from the Roster slot
  (it shows on both rows) → pair them → the Chart shows the duo; swap flips front/back. On Kana's
  profile, Parent B is Anna. Progression reclass at 10 recomputes the skills below.
- `VITE_ASSETS=off` renders monograms and the gradient splash everywhere.
- The owner signs off on sprites (A-gate) and on the final screens.

---

# v2 record (historical)

Branch: **`v2`** (off `main`; v1 is tagged `v1-final`). Merge to `main` only when every milestone's
definition of done holds and the owner signs off.

Read first: [VISION.md](VISION.md) (what & why), [design/reference.html](design/reference.html)
(how it looks — open it in a browser at 390px and at 1280px), [DATA.md](DATA.md), [MODS.md](MODS.md).

## Progress checkpoint

M0 (setup/data/assets), P (responsive prototype) and M1–M5 (persisted Setup, Pairings, Individual,
Class Route, combat pair-up and Preview) are implemented on `v2`. Integration review covered 390×844
and 1280×800 layouts, the Ryoma × Camilla → Shiro growth journey, route-level carry, and an actual
copied share link opened read-only. Final checks are clean: lint, build and 52 tests across 10 files.
The main JavaScript entry is 111.28 KB gzip, with game data in separate lazy-loaded chunks. The
production service worker registers, precaches the shell and caches viewed WebP assets on demand.

M6 is not signed off yet: formal accessibility and Lighthouse reviews, an offline-mode check, and
the deployment workflow still need review. Keep the branch on `v2` until those checks and the owner's
review are complete. Current gameplay-data limitations are recorded in [DATA.md](DATA.md).

## Roles

| Role | Who | Scope |
|---|---|---|
| Owner / reviewer | Opus 5.5 (top-level) + the user | Direction, final review, merge |
| **Setup agent** | DeepSeek V4.1 Flash | Milestone 0 only: scaffold (M0a), data port + asset pipeline (M0b) |
| **Prototype agent** | DeepSeek V4.1 Flash | Milestone P: non-functional prototype of every page/layout, in a worktree (`v2-prototype`) |
| **Build orchestrator** | DeepSeek V4.1 Flash | Milestones 1–6: plans work, fans out to builders, reviews diffs, integrates, verifies |
| Builders (spawned by orchestrator) | DeepSeek V4.1 Flash / GLM-5.3 Flash | One well-scoped task each, disjoint files |
| Escalation | GPT Sol, then Opus 5.5 | Only when a cheap builder fails twice on the same task — attach the failed attempt |

Orchestrator rules: builders get **disjoint file ownership** per task; the orchestrator owns
`src/state/`, routing and `index.css` tokens, and merges. Every task ends with lint + build + tests
green. Commit per milestone with clear messages (small commits within a milestone are fine).

## Milestone 0 — Setup (setup agent)

Two commits: **M0a** (steps 1 + 4: scaffold, tokens, shell — commit message starts with `M0a:`, committed
early because the prototype agent branches from it) then **M0b** (steps 2, 3, 5: data + assets + docs).

1. Fresh app scaffold on `v2`: Vite + React + TypeScript strict (`verbatimModuleSyntax`,
   `erasableSyntaxOnly`), Zustand, a tiny hash router, vite-plugin-pwa, oxlint, **Vitest**. No CSS
   framework — plain CSS with design tokens transcribed from `docs/design/reference.html`.
   Remove v1 `src/screens`, `src/components`, `src/index.css`, `src/App.tsx`; keep `src/data/packs`,
   the extractors, and port `src/logic` + `src/data/types.ts` (review, don't trust blindly — add
   tests pinning the AGENTS.md spot-check values).
2. **Data additions** (extend extractors, never hand-edit packs): skill descriptions and learn
   data, DLC flags on classes/skills/units, route availability (curated JSON with sources if not in
   the tables), class pair-up bonuses (already present — expose), support-rank pair-up table.
3. **Assets pipeline** `tools/assets/`: extract class sprites, skill icons and character face icons
   from the owner's romfs dump (`../3ds-games/fe-fates/work/cia-extract/romfs/`: `icon/*.bch.lz`,
   `face/`, `unit/`) → optimised WebP/PNG in `public/assets/{classes,skills,units}/` + a generated
   `src/data/assets.json` manifest (game id → path). Use existing tools where possible (fe-fates
   `tools/fe_tools` LZ13/BinArchive; BCH/CTPK texture decoders — document what you used). Fallback
   sources only per VISION.md › Assets, logged in `docs/ASSETS.md`. Placeholder monogram when an
   asset is missing or `VITE_ASSETS=off`.
4. An `AssetImage` / `Sprite` component, the token CSS, the app shell (header, lens switcher,
   empty routes) rendering at 390px — no feature screens yet.
5. Update `README.md`, `AGENTS.md` commands, `docs/DATA.md`, new `docs/ASSETS.md`.

**Done when:** `npm run lint && npm run build && npm test` clean; shell renders; ≥ 90 % of units,
classes and skills resolve to a real asset (report coverage numbers); spot-check tests pass.

## Milestone P — Non-functional prototype (prototype agent, parallel with M0b)

Starts as soon as the **M0a** scaffold commit lands; works in its own worktree on branch
`v2-prototype` (branched from `v2`) so it never collides with the data/asset work. The build
orchestrator merges it into `v2` before M1.

Goal: every page and layout exists, looks finished, is clickable between pages — and computes
nothing. It is the skeleton the orchestrator wires up, so structure matters more than polish:

- **View-model seam.** Screens never import fixtures directly. Each screen reads from a hook in
  `src/viewmodels/` (`useSetupVM`, `usePairingsVM`, `useUnitVM(unitId)`, `useClassRouteVM(unitId)`,
  `usePreviewVM`, `useRunsVM`) that returns a typed view model built from `src/prototype/fixtures.ts`
  and no-op action callbacks (`onSetPartner`, `onAddStop`, …). Wiring = replacing hook bodies with
  store selectors/actions; screens and components should need no changes.
- **Presentational components** in `src/components/` (Sprite, SkillGem, Hanko, Chip, GrowthSpark,
  CapPips, StatBars, ClassCard, RouteTimeline, DuoCard, CompareTray, BottomSheet, LensSwitcher,
  RunPill, …) — props in, markup out, no store access.
- **Pages & states** (all at 390×844 *and* ≥1024px two-pane): first-run Setup flow (modpack, DLC,
  route, name) and Runs manager (switch, duplicate, delete, export/import, share); Pairings lens
  (grid, filters/sort, compare tray, partner-picker sheet with graph badges, Corrin card, child rows,
  conflict chips, empty/filtered-empty); Individual lens (header + relationship strip, class options
  with 2-up compare, stats panel with pair-up delta, skill slots + skill-picker sheet, inheritance
  panel for a child, combat partner/role); Class route (timeline, add-stop sheet, validation
  warnings); Preview lens (duos, solos, unassigned; read-only); DLC-off and missing-asset states.
- Fixtures use real names and the sample numbers from `docs/design/reference.html`; shapes must
  match `src/data/types.ts` domain types where they exist.
- Screenshots of every page at both sizes in `docs/screenshots/prototype/`.

**Done when:** lint/build clean; every page reachable via the lens switcher / links; screenshots
committed; `docs/PROTOTYPE.md` lists each screen → its view-model hook → the fields/actions to wire.

## Milestone 1 — State, persistence & Setup flow

First: merge `v2-prototype` into `v2` and make sure it builds. Then wire each prototype screen by
replacing view-model hook bodies — keep the seam.

Plan model (new, `schema: 3`, fresh localStorage key — no v1 migration needed):

```ts
Run { id, name, modpackId, dlc: boolean, route, corrin: { gender, boon, bane, talentClassId },
      units: Record<unitId, UnitPlan>, createdAt, updatedAt }
UnitPlan { unitId, inArmy, sPartner?, aPlusPartner?, variableParent?,   // relationships
           classRoute: ClassStop[], skills: skillId[5], inheritSkill?,    // build
           combatPartner?, combatRole?: 'front'|'back', notes? }
ClassStop { classId, fromLevel, toLevel, via: 'start'|'promotion'|'heart'|'partner'|'friendship'|'master'|'eternal'|'offspring'|'dlc' }
```

Selectors derive everything else (child growths, pools, pair-up) — nothing derived is stored.
Setup screen: modpack, DLC toggle, route, run name; run switcher; export/import/share.

## Milestone 2 — Pairings lens

Unit grid with sprite, personal skill, class chips, growth sparkline, cap pips; filters/sort;
compare tray (2–4 units); relationship editor with graph-aware partner picker; children inline;
Corrin card; conflict chips. Must stay smooth with 70+ units (virtualise if needed).

## Milestone 3 — Individual lens: stats, classes, skills

Relationship strip (editable), class options grouped by source with growth/cap cards and 2-up
compare, stat panel (bases / growths / caps / projected averages at level N), pair-up delta layer,
five-slot skill planner with source + learn-level tags, inheritance panel for children.

## Milestone 4 — Class route planner

Timeline editor for `classRoute`, rule validation (levels, seals, promotion resets, Eternal Seals,
DLC gating), skills-acquired-per-stop, "add stop to reach this skill" from the skill planner,
projected stats along the route.

## Milestone 5 — Combat pair-up & Preview lens

Combat partner + role in Individual; Preview lens: read-only, grouped by front/back duos then solo
and unassigned, permanent decisions emphasised, planned class/skills de-emphasised, share link
opens straight into Preview, print stylesheet.

## Milestone 6 — Polish & ship

Desktop two-pane layouts (≥1024px), motion per the reference (respect `prefers-reduced-motion`),
empty states, a11y pass (focus, labels, contrast, 44px targets), Lighthouse targets from
VISION.md, PWA offline incl. lazily cached assets, docs refresh, deploy workflow still green.

## Verification (every milestone)

1. `npm run lint && npm run build && npm test` — clean.
2. Browser at **390×844** and **1280×800** (Paseo browser tools or Playwright screenshots saved to
   `docs/screenshots/m<N>/`), compared against `docs/design/reference.html`.
3. Data spot-checks (AGENTS.md › Verification) as automated tests, plus per-milestone journeys:
   - M2: marry Ryoma × Camilla → Shiro appears with growths = floor((Shiro + Camilla) / 2).
   - M3: Corrin boon Spd/bane Lck changes growths; Shiro's pool includes Camilla's branch.
   - M4: a route Samurai 1→10 → Swordmaster acquires the right skills; an illegal jump is flagged.
   - M5: two duos + one solo render correctly in Preview; share link round-trips.

## Completion record

- M0, P and M1–M5 implementation is present on `v2`; see `docs/PROTOTYPE.md` at tag `v2-final` for the
  production screen/hook map and [DATA.md](DATA.md) for mechanics caveats.
- P's screenshots in `docs/screenshots/prototype/` document the original fixture-backed layouts.
- M6 and the final merge to `main` remain open until its checks and owner review are complete.
