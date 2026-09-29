# v3 design spec — Figma overhaul

**Source of truth:** Figma file `bT3rsrSL9exw83MYWzMF73`, plus the owner's clarification notes (below).
It supersedes `docs/design/reference.html` (now historical). The mobile frames are 390×844. Desktop
layouts and the Runs/setup/picker screens are not in Figma; they are specified here and follow the
same visual language.

| Screen | Figma node | Archived export |
|---|---|---|
| Roster | `3:970` | [figma/roster-3_970.tsx](figma/roster-3_970.tsx) |
| Character (header + Profile tab open) | `3:2859` | [figma/character-3_2859.tsx](figma/character-3_2859.tsx) |
| Character › Avatar (Corrin only) | `3:5890` | values transcribed below |
| Character › Profile | `3:5891` | [figma/profile-3_5891.tsx](figma/profile-3_5891.tsx) |
| Character › Stats | `3:5892` | [figma/stats-3_5892.tsx](figma/stats-3_5892.tsx) |
| Character › Progression | `3:10133` | [figma/progression-3_10133.tsx](figma/progression-3_10133.tsx) |
| Chart | `3:10134` | values transcribed below |

The `figma/*.tsx` files are raw React+Tailwind exports kept as **measurement references only**. Never
import them or copy Tailwind classes; translate them to the token CSS. Their image URLs expire; the
character art in them is placeholder art from the mock and must come from the asset pipeline. The
UI icons were downloaded to [figma/icons/](figma/icons/) (Iconify sets: `mdi`, `bi`, `boxicons`,
`ant-design`, `charm`, `carbon`, `material-symbols-light`). Recolour them with `currentColor` when
they are ported to `src/components/icons/`.

## Tokens (replace `src/styles/tokens.css`)

The mock uses about 14 ad-hoc greys (owner note 3). Consolidate them into the scale below. **Every
active or selected state uses the route accent.** "Darkened when selected" becomes `--accent-strong`.

| Token | Value | Replaces in Figma |
|---|---|---|
| `--ink` | `#1b1b1b` | `#000`, `#1b1b1b` text |
| `--ink-2` | `#8e8e8e` | muted labels, inactive tabs, "No reclass" |
| `--ink-3` | `#c7c7c7` | outline star, disabled |
| `--surface` | `#ffffff` | page, cards |
| `--surface-2` | `#f6f6f6` | stat value cells, locked personal-skill card (`#ececec`) |
| `--surface-3` | `#e3e3e3` | stat header cells, chips, dropdowns (`#dfdfdf`, `#e3e3e3`) |
| `--line` | `#e6e6e6` | row dividers, card borders (`#dbdbdb`, `#dfdfdf`, `#ededed`) |
| `--line-strong` | `#bdbdbd` | outlined pills (`#adadad`, `#bdbdbd`) |
| `--scrim` | `#414141` | overlays, the Progression info panel, the edit-arrow button |
| `--hoshido` / `--nohr` / `--valla` | keep v2 hues `#d4432c` / `#6a4bc4` / `#178f86` | — |
| `--accent` | route hue (`data-route` on `.app`) | selected tab text underline, active pills |
| `--accent-strong` | `color-mix(in oklab, var(--accent) 55%, #1b1b1b)` | selected class card, talent, gender (`#414141`, `#3d3d3d`, `#363636`) |
| `--accent-soft` | `color-mix(in oklab, var(--accent) 12%, #fff)` | hover/pressed wash |
| `--rel-s` | `#c57373` | S-rank slot border and placeholder |
| `--rel-a` | `#6981d0` | A+ slot |
| `--rel-pair` | `#5eb761` | pair-up slot (`#69d06d`) |
| `--good` / `--good-soft` | `#5eb761` / `#9ed2a0` | boon fill / boon outline |
| `--bad` / `--bad-soft` | `#be5555` / `#f5adad` | bane fill / bane outline |

Relationship hues are **semantic** (which slot this is), not selection, so they stay fixed on every
route. `--rel-s` (dusty rose) was checked against the Birthright vermilion accent: the two are
distinguishable, but never put S-slot borders on an accent background.

Type: **Inter** (self-host 400/500/600/700 as woff2, `font-display: swap`). The type scale is taken
from the mock:

| Role | Spec |
|---|---|
| Screen title ("Roster", "Chart") | 38px / 700 |
| Character name on splash | 38px / 700, white |
| Section heading ("Relationships", "Effective") | 21px / 700 |
| Unit name in a list row | 21px / 400 |
| Sub-heading ("S Rank", "Boon", "Max Stats") | 14px / 600 |
| Body, pills, tabs | 14px / 500 |
| Stat table cells, nav labels, captions | 12px / 600 |

Radii: `--r-xs 4px` (stat cells, chips), `--r-sm 5px`, `--r-md 8px` (cards), `--r-lg 10px` (chart
cards), `--r-sheet 30px` (character panel top), `--r-pill 999px`. Spacing follows the mock: 2px
stat-cell gaps, 6/8/10/12px layout gaps, 10–12px screen gutters. Tap targets are ≥ 44px, but hit
areas may extend past the visible chip.

## Shared components

- **StatTable**: 8 columns (HP…Res). A header row of `--surface-3` cells and a value row of
  `--surface-2` cells, both 12px/600, 2px gaps, `--r-xs`. A value can be a number, a signed number
  (`+2`, for modifiers), a percentage for growths, or **`-` meaning not applicable** (HP has no cap
  modifier and no pair-up bonus). Optional per-cell tone for positive/negative values.
- **StatLensRail**: a horizontal scroller of lens tabs. On the Roster it uses an underline tab style
  (active = `--ink` text + 2px `--accent` underline). In class cards it uses a pill style (active =
  `--accent-strong` fill, white text; inactive = `--line-strong` outline, `--ink-2` text).
- **Segmented**: pill track (`--surface-3`) with a white active thumb. Used for Base / Advanced /
  All and Front / Back.
- **PortraitChip**: a square `--surface-3` tile, `--r-xs` radius, with the talk-portrait face crop.
  Sizes are 32 (roster name), 28 (relationship slots in a row) and 24 (chart).
- **RelationSlot** (28px): when empty, a dashed border in the slot hue with the glyph (`S`, `A+`,
  crossed swords) at 50% hue. When filled, a PortraitChip with a 1px solid border in the slot hue.
- **ClassSprite**: the stitched map sprite (body + the unit's head, see *Assets*). It renders on a
  `--surface-3` tile in lists and has no tile in the talent cards.
- **SkillIcon** (20–32px) and **SkillCard** (icon over name on the left, description on the right;
  12px `--ink-2`). The locked personal-skill card uses `--surface-2` fill and no border.
- **BottomNav**: Roster / Chart / Runs, with icons at 30px and 12px/600 labels. The active item uses
  the filled icon variant and `--accent` colour. The bar is 97px tall with a `--line` top border and
  respects the safe area.
- **Sheet** (mobile) / **Popover** (desktop): used by every picker.

## Roster (`3:970`)

- Header: "Roster" title, with the **sort button** top-right. The icon reflects the active sort.
  Sorts are *Recruit order* (default, per route; `mdi:sort-clock-ascending-outline`), *Name*
  (`mdi:sort-alphabetical-ascending`) and *Stat* (sort by one column of the current lens, descending;
  `mdi:sort-numeric-descending`). Tapping opens a small sheet. The Stat sort needs a column pick:
  HP…Res chips. **Favourites always sort first**, then the chosen sort, then recruit order as the
  tiebreak. Recruit order puts optional recruits at their chapter (e.g. Mozu at her paralogue's
  place) and pushes **all children to the end** (in paralogue order). `-` cells cannot be sorted:
  columns showing `-` are not offered in the Stat pick, and switching the lens rail to a lens that
  blanks the sorted column resets the sort to Recruit order (`reconcileRosterSort`).
- **Lens rail** under the title: every lens from the Stats tab, in this order: Stat Modifiers,
  Personal Growth Rates, Effective Growth Rates, Max Stats, Effective Pair Up Bonuses, Personal
  Pair Up Bonuses, Base Stats, Class Growth Rates, Class Pair Up Bonuses. The choice persists in UI
  state, not in the run.
- **Row** (padding 12/10, `--line` bottom border). Left side: PortraitChip 32, name, and a favourite
  star (filled `--ink` / outline `--ink-3`; tap toggles). Right side, gap 6: ClassSprite (tap opens
  the **class popup** listing every class available to the unit, grouped Base / Advanced; picking
  one sets the current class), then the S, A+ and pair-up RelationSlots (**child rows get a fourth
  "Parent B" slot**, in `--ink-2` outline, synced with that parent's S slot; each opens the
  **character picker** for that slot), then the edit button (dark circle + arrow, opens the
  Character page). Below: a StatTable for the active lens.
- **Children are always listed** (sorted to the end in Recruit order) and treated as available,
  whether or not their parent has an S partner. There is no "needs a parent" state.
- Rows use `content-visibility: auto`. There are about 70 rows, so there's no virtualiser unless
  profiling says otherwise.

## Character page (`3:2859`)

- **Header** (about 316px): the **splash art** (official promo art, focal-cropped per character)
  with a bottom gradient to black. Top-left: a round white back button that returns to the
  originating screen (Roster or Chart; use history). Bottom-left: the name (38/700, white) and the
  favourite star (white variant). Below that are the **tab pills**. The active tab is white fill with
  `--ink` text; inactive tabs are `rgb(0 0 0 / .45)` fill with white text. The tabs are
  **Avatar** (Corrin only), **Profile**, **Stats** and **Progression**; the default is Profile.
- **Panel**: white, with a `--r-sheet` top radius, overlapping the splash by about 78px. Tab
  contents scroll inside the page (the whole page scrolls; the header is not sticky).

### Avatar tab (`3:5890`) — Corrin only

- **Gender**: two square cards side by side (gap 10, `--r-md`) showing the male and female Corrin
  promo art. Selected: 4px `--accent-strong` border, dark base, black gradient, white label.
  Unselected: 1px `--line` border, 56% opacity, white gradient, `--ink` label. The selection
  switches the splash art and Corrin's gendered classes.
- **Boon** / **Bane**: a 4×2 grid of chips (`min-width 73px`, `--r-xs`) with a name and a
  `(Stat)` line. Boon chips use a `--good-soft` outline and `--ink-2` text; the selected boon is
  `--good` fill with white text. Bane chips use `--bad-soft` / `--bad` the same way. Boon ≠ bane is
  enforced (the matching chip in the other grid is disabled).
- **Talent**: a horizontal scroller of 102px square cards, each showing the tree's base and
  promoted ClassSprites overlapped by −12px, plus the tree name. The selected card is
  `--accent-strong` fill with white text; the rest are `--line` outline with `--ink-2` text.
  Sprites use Corrin's head for the current gender.

### Profile tab (`3:5891`)

- **Relationships** (21/700): three equal columns, **S Rank**, **A+ Rank** and **Pair Up**. Each
  has a 14/600 label and a card about 114px tall: a talk-portrait bust crop with the name overlaid
  bottom-centre (white, 14/700, shadow) and a 1px border in the slot hue. Empty cards show the slot
  glyph on `--surface-2`. The caption below is italic 12px `--ink-2`: "Gains *Class*" for S and A+
  (the class the Partner or Friendship Seal unlocks); for Pair Up it's a **Front / Back**
  Segmented. **Child units get a fourth "Parent B" slot**, which is the variable parent and stays
  in sync with that parent's S slot (setting either side writes both).
- **Classes**: the heading with a Base / Advanced / All Segmented on the right, then a pill
  StatLensRail of class-relevant lenses (Base Stats, Max Stats, Class Growth Rates, Effective Growth
  Rates, Class Pair Up Bonuses). **Class cards** (`--r-md`, `--line` border) show the sprite, class
  name (14/700) and StatTable. Tapping a card selects it: `--accent-strong` fill, white text and a
  "SELECTED" tag. Selection sets the unit's current class (the same field as the Roster class
  popup).
- **Skills**: the personal skill first (locked card), then five equip slots. Tapping a slot opens
  the **skill picker** (the unit's reachable skill pool plus inheritable skills; each row shows the
  source and learn level). An empty slot shows a dashed placeholder and "Empty slot".

### Stats tab (`3:5892`)

These are sections of labelled StatTables with `--line` dividers between sections:

- **Effective**: Effective Growth Rates, Max Stats, Effective Pair Up Bonuses.
- **Personal**: Stat Modifiers, Personal Growth Rates, Personal Pair Up Bonuses.
- **Class**: a pill rail of the unit's classes (defaults to the current class; this selection only
  changes what this section shows), then Base Stats, Class Growth Rates and Class Pair Up Bonuses.

Lens definitions (the single source for the Roster rail too; implement in `src/logic/lenses.ts`):

| Lens | Value |
|---|---|
| Stat Modifiers | personal cap modifiers (+ boon/bane for Corrin; child = fixed + variable parent mods, +1 rule); HP `-` |
| Personal Growth Rates | personal growths (+ boon/bane; child = averaged with the variable parent) |
| Class Growth Rates | class growths of the selected/current class |
| Effective Growth Rates | personal + class growths |
| Base Stats | class base stats (Stats tab: selected class; Roster: current class) |
| Max Stats | class caps + stat modifiers |
| Personal Pair Up Bonuses | the unit's own support-rank pair-up rows at the partner's rank (or the S row when no partner is set) |
| Class Pair Up Bonuses | the class `pairUp` row |
| Effective Pair Up Bonuses | class pair-up + support-rank bonus with the current pair-up partner; HP `-` |

### Progression tab (`3:10133`)

- For **children**, an **Inherited skill** card sits at the top (SkillCard style, opens the skill
  picker limited to the variable parent's equipped/learnable skills).
- The page is split into **segments**, one per class tier the route passes through: Base (1–20),
  Advanced (1–20), Special (1–40), plus Eternal Seal extensions (+5 each). A segment only
  exists while the route needs it. Each segment has a 21/700 heading, then **one row per level**:
  the level number (14/700), the skills learned at that level ("Learns ◆ *Skill*", italic `--ink-2`
  label with icon; level 1 of the starting class shows "Starts with" and the personal skill), a
  dotted leader line, an **info button**, and a **reclass dropdown** (`--surface-3`, `--r-xs`, 12px;
  the placeholder is italic "No reclass").
- A reclass chosen at level *n* takes effect from level *n*. The rest of that segment recomputes
  (skills learned, levels remaining). Choosing a promoted class **ends the segment** and starts the
  Advanced one at 1. Base↔base and promoted↔promoted keep the level. Special-class and DLC rules
  come from `src/logic/classRoute.ts` (Master Seal ≥ 10, level carry/convert, Eternal Seal +5).
  Invalid picks are not offered, and later rows made invalid by an earlier change are cleared with
  a toast ("Removed 2 later reclasses").
- **Info panel**: the info button toggles a full-bleed `--scrim` panel under the row, with a caret
  pointing to the button. It shows *Expected Stats* (average stats at that level on this path),
  *Effective Growth Rate* (for the class at that level) and *Effective Pair Up Bonuses*. The
  StatTables use inverted tones (white headings). Only one panel is open at a time.
- The first-gen start level comes from the recruitment data (join level and class per route).
  Children start from their paralogue level only if that's cheap; otherwise start at Base 1 and note
  it.

## Chart (`3:10134`)

- The "Chart" title, then a list of cards (`--line` border, `--r-lg`, gap 20, padding 10).
- A **pair card** has two rows, front on top. Each row has a ClassSprite chip (24), name (21/400),
  a favourite star, the unit's **five equipped skill icons** (20px, gap 5) and an edit arrow (20px)
  that opens the Character page. A **swap button** (`charm:swap-vertical`, on a white knockout
  over the divider) swaps front and back, which rewrites both units' pair-up roles.
- A **solo card** is a single row for any in-army unit with no pair-up partner.
- Order: pairs in the roster's current sort order of their front unit, then solos.
- Desktop: two-column grid of cards.

## Screens not in Figma (intuited — owner notes 1–2)

### Runs (bottom-nav tab)

- The "Runs" title, then a list of run cards. Each card has a left accent stripe in the run's route
  hue, the run name (21/400), a subline "Revelation · UGF 2.5.2 · DLC on · 34 units", and a "More"
  menu (Duplicate, Export JSON, Share link, Delete with confirm). The active run shows an
  `--accent-strong` "ACTIVE" tag; tapping another run switches to it.
- Footer actions: **New run** (primary, `--accent-strong`) and **Import** (outline).
- **Game build** dropdown per run: the only mod-list surface (AGENTS.md rule).

### New-run setup (full-screen flow, three steps with a progress bar)

1. **Name + game build**: a text field and the build dropdown.
2. **Route**: three large cards (Birthright / Conquest / Revelation) with the route hue as the card
   fill when selected, plus a **DLC** switch. Selecting a route immediately previews the accent
   across the flow.
3. **Your Corrin**: the Avatar tab component reused as-is (gender, boon, bane, talent).

Then "Start planning" lands on Roster. First launch with no runs goes straight into this flow.

### Pickers

- **Character picker** (S / A+ / pair-up / parent B): a sheet titled "S Rank for Corrin". It has a
  search field, then a 4-column grid of portrait cards (name below). Each card carries badges from
  the build's support graph: support speed (fast), and "Taken" when the candidate is already in
  another relationship of the same kind (still selectable; confirming shows what gets unlinked).
  Candidates that the graph disallows for this slot are hidden. A "Clear" action is in the header.
  S and A+ show the "Gains *Class*" line under each candidate.
- **Class popup**: classes available to the unit, grouped by source (Own, Parent, Partner Seal,
  Friendship Seal, Talent, DLC) as sprite + name rows. The current class has an accent check.
- **Skill picker**: a list of SkillCards grouped by source, each with "Lv 10 · Samurai" learn
  tags. Skills the progression doesn't reach show "Not on route" in `--ink-2`, and are still
  selectable.

## Desktop (≥ 1024px; the mock is mobile-only)

- The BottomNav becomes a **left rail** (72px, icons + labels, vertical).
- **Roster + Character two-pane**: the roster list sits in a 440px left pane. The right pane shows
  the selected character page (splash header 280px, capped content width 720px). There's no back
  button; the edit arrow selects the row. The route stays `#/unit/:id`.
- **Chart**: two-column card grid, max width 1100px.
- **Runs**: a centred 720px column. Setup runs as a centred card, not full-screen.
- Sheets become anchored popovers (class popup, pickers ≤ 480px wide) or centred dialogs
  (character picker, 720px grid of 6 columns).
- Everything else scales naturally. Stat tables cap at 520px wide on desktop so the numbers don't
  float apart.

## Assets required (see BUILD_PLAN v3 › A)

| Set | Used by | Source |
|---|---|---|
| Talk portraits (`_st`, neutral expression, hair merged) → face crop + bust crop | PortraitChip, relationship cards, pickers | Owner's romfs `face/face/<name>_st.arc` (same decoder as the existing `_bu` faces). The owner's note says "source online"; the dump holds the same official talk sprites, so prefer it and fall back online only if extraction fails. |
| Promo / splash art (Corrin M and F too) | Character header, Corrin gender cards | Online: official Fates base artwork, whichever of Fire Emblem Wiki / Serenes Forest has the higher resolution. Record each source in `docs/ASSETS.md`. Per-character focal point in the manifest. |
| Stitched map sprites (body + unit head) | ClassSprite everywhere | romfs `unit/Body/<class>/青0.bch.lz` + `unit/Head/<unit>/青0.bch.lz`, with offsets from `unit/Body/<class>/anime.bin`; `unit/Unique/` overrides (Velouria, Keaton, Kana dragon…). Stitched **at runtime** from body frame + head frame + offsets. |
| Skill icons | as today | unchanged |
| UI icons | nav, sort, info, swap, star, edit | `docs/design/figma/icons/` → `src/components/icons/` |

Everything must still render with `VITE_ASSETS=off`: monograms for portraits and sprites, a
route-hue gradient for splash.

## Owner clarification notes (verbatim)

> note 1: the run setup and selection pages have not been defined; you may intuit these based on the designs provided.
> note 2: the designs supplied are mobile only; please intuit desktop designs based on these.
> note 3: colours are used in this design without regard for consistent tokens. please use consistent tokens across the design for colours. for active selections, please use an accent colour that reflects the chosen route (br/cq/rev)

Per-screen notes are folded into the sections above; the original file is attached to the
2026-09-29 overhaul request.
