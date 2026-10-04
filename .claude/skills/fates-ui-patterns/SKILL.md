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
  picker (`fill`: pages fill the fixed-height sheet and each scrolls itself). The track's inline `transform` places the active page and
  `useSwipePager(panelRef, …)` adds the live drag as an inline `translate`; the viewport takes the
  active page's height (ResizeObserver → inline `height`) with `overflow: clip` (not hidden — sticky must keep working inside). Owner asked for
  this because SlideSwap only rendered the neighbour on commit ("content pops in mid swipe").
  Inactive pages are `inert` + `aria-hidden`.
- `CharacterPage` keys the screen by unit, except both Corrins share the key `corrin`: the Avatar
  gender switch navigates to the other Corrin without remounting, so `SplashSwap` cross-fades the
  splash (600ms) and scroll stays put. The scroll reset runs on mount only.
- `--char-head-h` (measured sticky head height on the article) lets rails inside tabs stick under the
  head: Profile › Classes' lens rail is `.class-lens-rail` (sticky, `top: var(--char-head-h)`).
- **Hero = inset art container (Figma 19:642, owner v3.4)**: `.char-hero` is `--hero-h` (233px) tall,
  `--page-margin` (`--s4`, 12px - the character sections' margin) in from the sides and **flush with
  the top** (owner: the card touches the top of the page; page content starts right under it), with `--hero-pad` = the page margin as padding on every side (back
  button, name, pills). Radius is concentric (owner): `min(pill height, back size) / 2 + padding` =
  16 + 12 = 28px (the pills win over the back button's 20 + 12); the pills' min-height reads
  `--hero-tabs-h` so the maths holds. The art is the unit's **talk portrait** at native 1x resolution
  (owner, 2026-10-04; critical cut-ins were tried and dropped because the 2:1 art didn't fit).
  `HeroPortrait` aligns the portrait's top edge with the hero container's top and uses FaceData's
  face rect to centre the face at 66% across the art box, with base + runtime-tinted hair on one frame, over a linear route-hue
  gradient light on the right (`.splash.fallback` shares it); the black overlay is
  `to top, rgb(0 0 0 / 0.6) 20%, transparent 58%` (toned down from Figma 19:644's 0.94) over the
  316px art box. Avatar gender cards use the bust `Portrait` (carries
  Corrin's tinted hair). See docs/ASSETS.md › Portrait artwork (v3.4). History: the owner first asked for fixed art behind per-tab rounded cards
  (2px apart); that couldn't reach under the iOS status bar (default status bar style = solid strip;
  `black-translucent` would turn the clock white on the white screens), so they chose this container
  and reverted the cards. Tab pages are plain again, `--pager-gap: var(--s2)` (6px, transparent).
- Roster stat strips: `--strip-gap: var(--s6)` (30px, owner: "a fair bit larger" than 12px).
- Class sprites: tapping one on the Roster **or the Chart** opens the class picker (`sprite-btn`);
  picker rows show bare sprites (the `tile` chip background was removed, owner v3.4).
- Back button (mobile): `.back-rail` ends one `--hero-foot-gap` (10px) above `.char-name-row`; its
  height subtracts the measured name row height, two foot gaps, tab height and bottom padding from
  `--hero-h`. The sticky `.back-btn` starts at 12px and stops with the same 10px gap above the name
  that separates the name from the tabs. `useScrolledPast` observes the hero back button at
  intersection ratio 0.5 and reveals the
  sticky header as the arrow becomes half hidden above the viewport. Embedded desktop pages keep the
  tab observer because they have no hero back button. Chromium and WebKit mobile tests found the
  midpoint at about 107-108px of scroll on the 233px hero; scrolling upward hides it again.
- General swipe/slider knowledge (physics, hand-over, profiling) is also in the global
  `frontend-dev` skill (`~/.claude/skills/frontend-dev/slider-physics/GUIDE.md`).
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
- **Page position = `translate`, swipe motion = `transform` (WebKit)**: the owner's iPhone recording
  showed an incoming card painted only as far as the screen edge at release (black beyond it for ~3
  frames, Profile -> Stats) while the release animated `translate`: WebKit only pre-paints the whole
  path of `transform` animations, and the main thread was busy re-rendering. So TabPager places its
  track with inline `translate` (CSS transition on `translate` for taps), StatStrip's CSS uses
  `translate`, and the drag / springs / tap ease-in animate `transform`. Chromium never showed it
  (~1000 traced frames) - test swipe painting on a device.
- `useSwipePager(ref, index, count, onChange, { enabled, targets })`: the drag writes an inline
  **`transform`** on the `targets` only (default `PAGER_TRACK` = the TabPager track; Roster: every
  `.stat-strip-track`), damped at the ends, with `[data-dragging]` → `will-change: transform`.
  Commit on distance/velocity (`swipeDirection`; velocity averaged over the last 80 ms of moves, 0 if
  the finger stopped before lifting). A drag that catches a page mid-settle picks it up where it is.
- **Release = velocity-matched spring (owner, v3.4: fixed ease-outs "snapped")**: `lib/spring.ts ›
  settleSpring(x0, v0)` is a critically damped spring (no bounce; flicks toward rest capped at ω·x0
  so it never overshoots) starting at the finger's speed, sampled into WAAPI keyframes (compositor;
  `SPRING_OMEGA` 0.016/ms is the one feel knob, pinned by `spring.test.ts`). On a commit it plays
  **the moment the finger lifts**, aimed at the neighbouring page in the old layout (`fill:
  forwards`), with `startTime` set to the timeline's now (no pending first frame). `onChange` is
  deferred a frame (`requestAnimationFrame` → `setTimeout`): React flushes native pointer events
  synchronously, so the owner's re-render in the same task held the page still (the Chart stutter).
  When the new `index` commits, the hook's layout effect swaps each target's spring for the same
  spring around the new layout **sharing the first one's `startTime`** (seamless), with the pager's
  CSS transform transition suppressed for that one change. `swipeSettling()` tells StatStrip to leave
  the motion to the swipe; it only animates rail taps itself. Verified with trace screenshots: a new
  compositor frame every ~16 ms after lift on Roster, Chart and character pages, through React's
  render, at 4x CPU.
- Rail taps (no swipe) still slide with `SETTLE_MS` (480) + `SETTLE_EASE` (cubic ease-out
  `0.33, 1, 0.68, 1`): TabPager's `.pager-track` CSS transition (literal copy in components.css) and
  StatStrip's ease-in.
- The Chart now renders one memoised `ChartList`; changing information switches re-renders only
  that list. The four full-page tab lists and their swipe pager were removed on 2026-10-04.
- **Swipe performance rules (v3.4, owner: "major slow down while swiping"; sprite pausing didn't fix
  it):** never set a custom property on a swipe surface or pager ancestor - custom properties
  inherit, so `--swipe-dx` on the list restyled 16-27k nodes per pointermove (100-200 ms frames on a
  phone). TabPager places its track with an inline `transform` and sizes the viewport with plain
  `height` for the same reason (`--page`/`--pager-h` were removed). StatStrip keys its pages by lens
  so a lens change reuses two of three tables per row, and eases in with `translate` in % (no
  per-row measuring mid-commit). Sprites share one IntersectionObserver (`art.tsx ›
  observeViewport`). `content-visibility: auto` on rows would roughly halve the Roster's release cost
  but was removed in v3.2 as a suspected iOS name-clipping cause - don't re-add without the owner.
  Measure with `scripts/swipe-profile.mjs` (`fates-dev-workflow` › Performance profiling).
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
  commit the pages re-key around the new lens and the track eases in from the release offset).
  SlideSwap is gone.
- **Progression foot (v3.4)**: `SealTally` shows icons + "x2" only with an info button opening a
  dark `--scrim` tooltip list whose rows show the item sprite inline with the name. On the
  Progression page the foot owns the chart's bottom border (`border-top`) and the bare row (no pill
  outline; `--s2` vertical padding plus `--s2` on the left, matching the info button's inner icon
  inset) hangs centred on the page (`left: 50%; translate(-50%, -50%)`); the
  `box-shadow: 0 0 0 --s2 var(--surface)` ring cuts the border with equal rounded caps and even
  stubs either side (`--seal-tail-x: 8px` keeps the tooltip tail on the button).
  The last `.panel-section` (`:has(+ .progression-foot)`) drops its border and pads its bottom to
  clear the row's top half. Eternal Seal buttons sit in two equal columns (Remove = outline left,
  Use = `btn primary` right, muted at 0). Automate progression: `bookOrClassChoices` sheet first,
  then `app/autoPlanner.ts` runs the search in `logic/autoProgression.worker.ts` (Vite module
  worker).
  The Chart floats the same `SealTally` bottom-right on mobile only (`.chart-seal-float`, hidden
  ≥1024px, tooltip right-aligned) with run-wide totals from `logic/tally.ts › runTallyItems`: one
  line at a fixed 240px on every mobile width (three icons plus a bite of the fourth even with
  two-digit counts), the right edge midway in the page margin, left padding `--s4 + --s2` (matches
  the button side), the icons scrolling border-to-border
  (scrollbar hidden; the float sits outside the chart pager's swipe surface, so native touch scroll
  works) under the fixed info button, whose `::after` surface gradient (`--seal-fade: 64px` covers
  the button) fades the list out;
  `flex: none` keeps the button from being squeezed. The shared tooltip (same component on the
  Progression foot) hugs its contents and right-aligns to the pill in both instances, is
  semi-transparent (`color-mix(--scrim 92%, transparent)`), carries `--shadow-float`, builds its
  tail into its own fill (no seam, positioned by `--seal-tail-x`) and pops out of the tail tip from
  scale(0) over 300ms (`seal-pop`, disabled under reduced motion).
- **Sprites pause while sliding (v3.4, `lib/motion.ts`)**: `useSwipePager` holds the motion flag while
  dragging and `settleMotion()` after; TabPager settles on every index change; `useAnimationIndex`
  stops ticking while held and rejoins the shared clock after (owner: swipes lagged).

## Components

- The per-run Mods checklist has Game data and Vanity sections. Only UGF and Unisex DLC Classes affect planning rules. `art.tsx` reads selected mods from the active run for `Portrait`, `HeroPortrait` and `ClassSprite`; `Portrait` and `ClassSprite` also accept a draft `run` for the New Run Corrin preview. `data/art.ts` resolves the vanity manifest and falls back to base art when a switch is off. Furry Fates changes four portraits plus Kaden/Keaton map sprites; Dragon-Hare changes both Corrin portraits.
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
- Chart information (owner, 2026-10-04): the tabs were replaced by one persisted switch sheet
  (`ui.chartDisplay`, opened from the tune button beside Sort). Favourites contains Notes, Skills,
  Progression routing, Pair up bonuses and Expected final stats. Stats contains the other stat
  lenses. `ChartScreen` renders one card list and filters out unhearted units when Chart Sort's
  Favourites only switch is on. A pair with just one heart becomes a solo card. Notes are stored
  as `UnitPlan.note`; `UnitNote` is shared by the Chart, the Roster's notes toggle and the top of
  the Profile tab. The note uses regular 12px text with its first line vertically centred in the
  one-line field, then grows by 20px per line. Rows use the normal `--s3`
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
