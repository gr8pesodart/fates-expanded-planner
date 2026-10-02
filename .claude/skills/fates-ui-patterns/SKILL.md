---
name: fates-ui-patterns
description: Architecture and design decisions of the planner's screens — the mobile character-page layer, the sticky header rail, swipe navigation with SlideSwap, the StatTable/SortIcon/sort-sheet components, relationship cards (Corrin's A-rank grid, open buttons, family links), the Parents page, icon sourcing and licences, Figma node references, and owner design rulings that override the mock. Use before changing screens, components or styles (src/screens, src/components, src/styles, src/App.tsx) or implementing a Figma frame.
---

# Fates planner — UI patterns and design decisions

Source of truth: `docs/design/SPEC.md` (from Figma file `bT3rsrSL9exw83MYWzMF73`; fetch frames with
the Figma MCP `get_screenshot` using fileKey + node id like `15:1542`). Colours only from
`src/styles/tokens.css`. Owner rule: **every selected/active state uses the route accent**
(`--accent` / `--accent-strong`) even when a Figma mock shows grey.

## App shell — `src/App.tsx`

- **Mobile:** `MobileMain` always renders a `.base-layer` with the section screen (Roster/Chart/Runs).
  On `#/unit/...` the character page renders in a fixed, scrolling `.character-layer` **on top**, and
  the base layer (the screen it was opened from, tracked as `backdrop`) stays mounted and `inert`.
  This is why closing a character — including iOS edge swipe-back, which previews a snapshot —
  doesn't re-render or "pop" the Roster (a Roster render is ~300–400 ms on a phone). Keep the base
  layer at the same tree position or React remounts it.
- **Desktop (≥1024px):** `DesktopMain` two-pane (Roster beside the character page).
- Character page scroll resets target `.character-layer`, never `window` (that would scroll the
  Roster underneath).

## Character page — `src/screens/CharacterScreen.tsx`

- Sticky header: a **zero-height sticky rail at the very top of the article** (`.char-sticky`), so it
  is pinned from the start; the head (back button, 21/700 name, tab pills) slides in (340ms ease-out)
  when the hero tabs scroll away (IntersectionObserver) and out (240ms ease-in). An earlier version put
  the rail inside the panel and it "hopped" when scrolling back up.
- Tabs: `navigate(..., { replace: true })`; switching preserves scroll.
- **Tab pager (v3.3; shared `components/TabPager.tsx` since v3.4)**: all tabs sit side by side in
  `TabPager` (`.pager` > `.pager-track` > `PagerPage`), mounted once shown (`lib/useMountedTabs`: the
  opening tab first, the rest after a delay). Also used by the Chart (tab swipes) and the skill
  picker (`fill`: pages fill the fixed-height sheet and each scrolls itself). The track translates by `--page` and the live `--swipe-dx` from
  `useSwipePager(panelRef, …)`; the viewport takes the active page's height (ResizeObserver →
  `--pager-h`) with `overflow: clip` (not hidden — sticky must keep working inside). Owner asked for
  this because SlideSwap only rendered the neighbour on commit ("content pops in mid swipe").
  Inactive pages are `inert` + `aria-hidden`.
- `CharacterPage` keys the screen by unit, except both Corrins share the key `corrin`: the Avatar
  gender switch navigates to the other Corrin without remounting, so `SplashSwap` cross-fades the
  splash (600ms) and scroll stays put. The scroll reset runs on mount only.
- `--char-head-h` (measured sticky head height on the article) lets rails inside tabs stick under the
  head: Profile › Classes' lens rail is `.class-lens-rail` (sticky, `top: var(--char-head-h)`).
- Opening animation: `.character-layer` slides in from 100% over 460ms, no fade (owner).
- Profile class cards: the favourite star sits *beside* the card button in `.class-card-wrap`
  (a button can't contain a button), absolutely over the head row.

## Swipes — `src/lib/swipe.ts`, `src/components/SlideSwap.tsx`

- `useHorizontalSwipe`: touch pointers only, direction-locked; ignores touches starting within
  **24px of the left edge** (iOS back gesture) and inside `input, select, textarea, .rail,
  .char-tabs, [data-swipe-ignore]` (the Avatar talent carousel has `data-swipe-ignore`). Mark swipe
  surfaces with `data-swipe` (CSS gives them `touch-action: pan-y`). Commit: |dx| > 48px or
  |velocity| > 0.3 px/ms (v3.3; was 72 / 0.45 — owner found it sticky). When testing with CDP
  touches, don't start the drag on an input (the Avatar Name field) — it's ignored by design.
- `useSwipePager(ref, index, count, onChange)`: live drag via `--swipe-dx` (damped at ends), commit
  on distance/velocity (`swipeDirection`), exit animation starts from `--swipe-from`.
- `SlideSwap`: on `index` change the old content slides out one side while the new enters from the
  other; the outgoing layer keeps its React key (no remount). Uses React's "store info from previous
  renders" state pattern — **don't read refs during render** (oxlint `react(refs)` fails the lint).
  Now only used by the Roster's StatTables; it doesn't clip (v3.4: tables slide off the page edge,
  `.screen.roster/.chart { overflow-x: clip }` does it). The skill picker moved off SlideSwap to the
  pager (owner: SlideSwap swipes felt slow - it re-rendered both lists on every tab change).
- **Touch-action trap (v3.4)**: a swipe surface whose children are their own scroll containers (the
  picker's `fill` pager pages) must put `touch-action: pan-y` on those children too - touch-action
  stops at the nearest scroll container, so the browser kept horizontal drags and the pager never
  saw them. Test swipes with CDP `Input.dispatchTouchEvent` (see `fates-dev-workflow`).
- **Rails (v3.4)**: `Rail` pills tween colours; `variant="tabs"` draws one `.rail-indicator` (a 1px
  bar moved with `translateX` + `scaleX`, so it slides on the compositor). `lib/useActiveInView`
  smooth-scrolls a rail (and the character tab pills) to keep the selection centred.
- Roster: the list is the swipe surface; every row's `StatTable` gets `slide` = { index, prev, next }
  (v3.4 strip: the neighbouring lenses' tables are rendered either side, so a drag shows them; on
  commit the track remounts centred and eases in from `--swipe-from`). SlideSwap is gone.
- **Progression foot (v3.4)**: `SealTally` is a pill (icons + "x2" only) with an info button opening a
  dark `--scrim` tooltip list; Eternal Seal buttons sit in two equal columns (Use = `btn primary`,
  Remove = outline, muted at 0). Automate progression: `bookOrClassChoices` sheet first, then
  `app/autoPlanner.ts` runs the search in `logic/autoProgression.worker.ts` (Vite module worker).
  The Chart floats the same `SealTally` bottom-right on mobile only (`.chart-seal-float`, hidden
  ≥1024px, tooltip right-aligned) with run-wide totals from `logic/tally.ts › runTallyItems`: one
  line capped at half the viewport (`50vw`; 6/12, three icons clear of the fade), the right edge
  midway in the page margin, the icons scrolling border-to-border (scrollbar hidden; the float sits
  outside the chart pager's swipe surface, so native touch scroll works) under the fixed info
  button, whose `::after` surface gradient fades the list out; `flex: none` keeps the button from
  being squeezed. The shared tooltip (same component on the Progression foot) is semi-transparent
  (`color-mix(--scrim 92%, transparent)`), at least as wide as the pill, with a tail over the info
  button and a 160ms `seal-pop` (disabled under reduced motion).
- **Sprites pause while sliding (v3.4, `lib/motion.ts`)**: `useSwipePager` holds the motion flag while
  dragging and `settleMotion()` after; TabPager settles on every index change; `useAnimationIndex`
  stops ticking while held and rejoins the shared clock after (owner: swipes lagged).

## Components

- `StatTable` (`components/StatTable.tsx`): `row` (9 values: HP…Res, Mov; `null` renders muted `-`),
  `signed`, `inverse`, `referenceRows` (enables text colouring), `mov={false}` (8 columns — Parents
  tables), `slideIndex` (slide on change).
- `SortIcon`: glyph + shared arrow (down = ascending). Recruit clock and name letters are the originals;
  stat glyphs are owner-chosen Iconify icons (licences in `docs/ASSETS.md` › UI icons;
  `game-icons:fluffy-wing` is **CC BY 3.0 — needs visible credit if published**).
- Sort sheets (`app/pickers.tsx`): Roster/Chart `SortSheet` (independent state each), Parents
  `ParentSortSheet` (recruit, name, inherited modifier/growth stats, direction, "Show the child's
  resulting values"). Sheets animate in and out (`closing` prop).
- `RelationCard` (`components/relations.tsx`) takes `partners[]`: 1 = bust card; 2–4 = 2×2 grid of
  busts; more = n×n face crops; cells always square, spare cells show the slot hue. Cards are buttons,
  so the white top-right **open button** (Figma 3:4136) sits beside it in `.rel-card-wrap`
  (`justify-self: stretch` is required — `.rel-col` centres items and the card collapsed without it).
  Corrin's A caption collapses to "Gains multiple" when >1 class (full list in title/aria-label).
- `UnitLink`: link row (portrait, name, arrow) for Children/Parents quick links and Parent A.
- `RelationCard stale`: a re-activated Corrin's partner who moved on — greyed card, one-line
  "Unavailable" caption (`--bad-ink`) in place of "Gains X"; full reason in title/aria-label.
- `SkillNotice` (`components/SkillNotice.tsx`, Figma 3:4348): inset under a `SkillCard` (`notice`
  prop) from `logic/skillAccess.ts`. Tones (owner v3.4): **blue** `info` "Not in progression",
  **yellow** `warn` "Only inheritable from A or B" / "Requires support" (Via S / A+ (Corrin: A) /
  Parent portraits, "Can also be inherited from" minus parents already listed), **red** `bad` "Not
  accessible". No class/level in the notice - that's the card's accent `tag`
  (`unitViews.ts › acquiredVia`, "Swordmaster Lv 5"). `ConflictNotice` = red "Not compatible with
  equipped X" (stat Takers, `unitViews.ts › skillRules`). `grey perClass` in the picker's Grouped
  view returns null for Not in progression / Not accessible (the heading says it).
- `SkillCard`: `label` (caps, above the description), `tag` (accent, under it), `caution` (muted),
  `muted` (equipped elsewhere → picking swaps), `faded` (not accessible: grey card, icon 50%),
  `aside` (picker star): with an aside the card is a div and its `.skill-card-main` button stretches
  over it (`::after`), so the star is centred beside the description and can be its own button.
  Personal skill lock is inline (`LockedName`, wraps with the first word).
- Skill picker (`app/pickers.tsx › EquipSkillPicker`): `Sheet toolbar` = tab Rail (Starred / Grouped /
  Ungrouped, `ui.skillPickerTab`); body = `TabPager fill` (all three mounted, each page scrolls on its
  own); page contents are one `useMemo` keyed on the plan, not the tab, so a tab change only moves the
  pager. Grouped: `GroupToc` sticky pill rail (scroll-spy on the page; tapping smooth-scrolls and
  suppresses the spy until `scrollend`/1.2s) - owner replaced sticky headings with it. Inheritable
  only heads show every parent's sprite (owner: keep all nine of Kana's); Requires support / Not
  accessible heads are faded. Shared pieces: `SkillTabsSheet` (tabs + pager), `GroupedSkills` +
  `GroupToc` (groups of `ClassBlock`s; the TOC scrolls its nearest `.skill-pick-page`) - the inherit
  picker is a plain Sheet with `GroupToc` and flat "In / Not in *Parent*'s progression" sections
  (owner: no tabs, no stars, no class grouping). Character tabs: Progression is always last.
  `SkillCard` descriptions get a zero-width space after every "/" (`wrappable`) so weapon lists wrap. `SkillCard label` is standard case (owner).
  `SkillFilterMenu` (per unit, `ui.skillFilters[unitId]` via `useSkillFilters`; "Parent flexible" only
  for a child with a second parent). Class bodies collapse by animating `grid-template-rows` 0fr↔1fr
  (always rendered, `inert` when closed). Sheets are fixed at 88dvh when they hold the picker. Inherit
  picker: the parent's equipped skills first. Chart, New Run, Runs and pickers are lazy chunks.
- Chart tabs (`ui.chartTab`, ids unchanged): Full / Skills Only / Skills + Progression / Skills + Pair
  Up (v3.4 labels; skills on every tab, pair-up on front and back units alike); `partsFor(tab)`
  decides skills / class path (`progression.ts › routeSteps`) / effective pair-up table per row.
  v3.4: each tab is a full chart in a `TabPager` (swipe to change tab). Rows use the normal `--s3`
  inset, starting with a real `chip-32` portrait (owner, v3.4) then the sprite at the Roster's `--s2`. The
  swap button lives in a zero-height `.chart-swap` between the rows so uneven rows don't misplace it.
- Class sprites: sizes in multiples of 32 only (see `fates-sprites`).

## Owner design rulings (keep)

- Roster header: **permanent** bottom border under the lens rail; Chart header: border fades in only
  after scrolling (`useScrolled`, 150ms). No drop shadows on sticky headers.
- Stat colouring is text colour, never cell fill; `-` placeholders use `--ink-2`.
- Run settings toggle is an animated chevron (not an ellipsis).
- Linked pair-up partners on the Roster get the Chart's swap button on the line between them.
- Route cards: standard 1px border tinted with the route accent — a coloured left border is banned.
- v3.3 rulings: Roster/Chart/header favourite = **heart** (`StarButton heart`); stars only for class
  favourites (`UnitPlan.favouriteClasses`), per-child parent favourites (`favouriteParents`, listed
  first on the Parents tab) and picker skill favourites (`favouriteSkills`). Hearts and stars are
  `--accent` (white via `light` on dark fills). Every toggle is `controls.tsx › Switch` (role=switch
  button with ON/OFF text) — no native checkboxes. Picker group "Requires support" (not
  "relationship"); filter labels "S rank flexible" / "A+ rank flexible". Skill icons at 1× (24px) everywhere, SkillCards included (`SkillIcon` snaps to multiples of 24).
  Expected Final Stats dims non-promoting rows (whole row but the open button). Hair swatches: 10×3
  rounded squares, 6px gap, default = swatch 1 (white). Sheets are portalled to `.app` (the tab
  strip's transform would trap `position: fixed`).
- v3.3 rulings: "on route" in owner notes about skills means the planned **progression** path (UI
  says "In / Not in progression"); notice colours: red from `--bad`, matching yellow `--warn`; grey
  notices in the picker; class favourites can't be switched off; Avatar gaps = boon/bane grid gap
  (`--s2`).
- Zoom is disabled in the installed app (viewport `maximum-scale=1`, `touch-action: manipulation`,
  `gesturestart` cancelled in `main.tsx`) — owner request, accessibility trade-off acknowledged.
- Parents page (Figma 15:1542): cards in one bordered list; chosen card inverts to `--accent-strong`;
  candidates joining before Parent A show italic muted chapter, later ones a bold "(+N chapters)".
