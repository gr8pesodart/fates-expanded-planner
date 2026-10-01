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
- Tab swipe: `useSwipePager(panelRef, …)` + `<SlideSwap index={activeIndex}>` around the tab content.

## Swipes — `src/lib/swipe.ts`, `src/components/SlideSwap.tsx`

- `useHorizontalSwipe`: touch pointers only, direction-locked; ignores touches starting within
  **24px of the left edge** (iOS back gesture) and inside `input, select, textarea, .rail,
  .char-tabs, [data-swipe-ignore]`. Mark swipe surfaces with `data-swipe` (CSS gives them
  `touch-action: pan-y`).
- `useSwipePager(ref, index, count, onChange)`: live drag via `--swipe-dx` (damped at ends), commit
  on distance/velocity (`swipeDirection`), exit animation starts from `--swipe-from`.
- `SlideSwap`: on `index` change the old content slides out one side while the new enters from the
  other; the outgoing layer keeps its React key (no remount). Uses React's "store info from previous
  renders" state pattern — **don't read refs during render** (oxlint `react(refs)` fails the lint).
- Roster: the list is the swipe surface; every row's `StatTable` gets `slideIndex` (lens index) so all
  tables slide together. Lens-rail taps animate the same way.

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
- Class sprites: sizes in multiples of 32 only (see `fates-sprites`).

## Owner design rulings (keep)

- Roster header: **permanent** bottom border under the lens rail; Chart header: border fades in only
  after scrolling (`useScrolled`, 150ms). No drop shadows on sticky headers.
- Stat colouring is text colour, never cell fill; `-` placeholders use `--ink-2`.
- Run settings toggle is an animated chevron (not an ellipsis).
- Linked pair-up partners on the Roster get the Chart's swap button on the line between them.
- Route cards: standard 1px border tinted with the route accent — a coloured left border is banned.
- Zoom is disabled in the installed app (viewport `maximum-scale=1`, `touch-action: manipulation`,
  `gesturestart` cancelled in `main.tsx`) — owner request, accessibility trade-off acknowledged.
- Parents page (Figma 15:1542): cards in one bordered list; chosen card inverts to `--accent-strong`;
  candidates joining before Parent A show italic muted chapter, later ones a bold "(+N chapters)".
