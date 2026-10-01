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
| `--bad-tint` / `--bad-ink` | `--bad-soft` 70% on white / `--bad` 72% on ink | "Not accessible" skill notice fill / text (Figma 3:4348) |
| `--warn` / `--warn-soft` | `#b39d2d` / `#efe39b` | a yellow matched to `--bad` / `--bad-soft` |
| `--warn-tint` / `--warn-ink` | `--warn-soft` 70% on white / `--warn` 72% on ink | "Not in progression" skill notice fill / text |
| `--stat-low` / `--stat-mid` / `--stat-high` | `#842334` / `#8a6a00` / `#12803f` | dynamic stat colouring (text colour, not fill; each stop ≥ 4.5:1 on `--surface-2`) |

Relationship hues are **semantic** (which slot this is), not selection, so they stay fixed on every
route. `--rel-s` (dusty rose) was checked against the Birthright vermilion accent: the two are
distinguishable, but never put S-slot borders on an accent background.
Route cards use a standard 1px border tinted with the route accent. A route-colored left border is
not used.

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

- **StatTable**: 9 columns (HP…Res, Mov). A header row of `--surface-3` cells and a value row of
  `--surface-2` cells, both 12px/600, 2px gaps, `--r-xs`. A value can be a number, a signed number
  (`+2`, for modifiers), a percentage for growths, or **`-` meaning not applicable** (HP has no cap
  modifier and no pair-up bonus). Dynamic stat lenses colour the value text low/average/high
  (`--stat-low` → `--stat-mid` → `--stat-high`), compared to the relevant army or same-tier class
  options; cells keep their neutral fill.
- **StatLensRail**: a horizontal scroller of lens tabs. On the Roster it uses an underline tab style
  (active = `--ink` text + 2px `--accent` underline). In class cards it uses a pill style (active =
  `--accent-strong` fill, white text; inactive = `--line-strong` outline, `--ink-2` text).
- **Segmented**: pill track (`--surface-3`) with a white active thumb. Used for Base / Advanced /
  All and Front / Back.
- **PortraitChip**: a square `--surface-3` tile, `--r-xs` radius, with the talk-portrait face crop.
  Sizes are 32 (roster name), 28 (relationship slots in a row) and 24 (chart).
- **RelationSlot** (28px): when empty, a dashed border in the slot hue with the glyph (`S`, `A+`,
  crossed swords) at 50% hue. When filled, a PortraitChip with a 1px solid border in the slot hue.
- **ClassSprite**: the stitched, animated idle map sprite (body + the unit's head, see *Assets*).
  It has no background tile on the Roster or Chart, but keeps a tile in the class picker.
- **SkillIcon** — native 24×24, drawn only at whole multiples (24 in lists, chips and the Chart; 48
  on SkillCards), like map sprites — and **SkillCard** (icon over name on the left, description on the right;
  12px `--ink-2`). The locked personal-skill card uses `--surface-2` fill and no border, with a 12px
  `--ink-2` lock inline to the left of the skill name (no "Personal skill" label).
- **BottomNav**: Roster / Chart / Runs, with icons at 30px and 12px/600 labels. The active item uses
  the filled icon variant and `--accent` colour. The bar is 97px tall with a `--line` top border and
  respects the safe area.
- **Sheet** (mobile) / **Popover** (desktop): used by every picker.

## Roster (`3:970`)

- Sticky header (no shadow; a permanent 1px `--line` bottom border under the lens rail — unlike the
  Chart's, which only fades in after scrolling): "Roster" title, lens
  rail and **sort button** top-right. With Link pair-up partners on, linked pairs sit together with
  the Chart's swap button on the line between them. The icon reflects the active
  sort and direction. The sheet presents Recruit order, Name and each stat with its own icon; `-`
  columns are disabled. Direction is selectable. A **Show** segmented control filters to All / First
  gen / Children (a filtered-out pair partner leaves the other unit unlinked). Favourites-first and
  Link pair-up partners are independent toggles. Linked partners occupy the earlier partner's sorted position; the pair's
  front member still displays first. Name/stat ties use recruit order. The Chart has its own sort
  state and the same controls. If changing the lens makes the chosen stat blank, sort resets to
  Recruit order (`reconcileRosterSort`).
- **Recruit order** is route-specific. Optional recruits sit at their chapter (e.g. Mozu at her
  paralogue's place), and all children sort after first-generation units in paralogue order.
- **Lens rail** under the title: every lens from the Stats tab, in this order: Stat Modifiers,
  Personal Growth Rates, Effective Growth Rates, Max Stats, **Expected Final Stats**, Effective Pair
  Up Bonuses, Personal Pair Up Bonuses, Base Stats, Class Growth Rates, Class Pair Up Bonuses. The
  choice persists in UI state, not in the run.
- **Expected Final Stats** (v3.3): average stats at the end of each unit's planned path, plus Mov of
  the class held there. With no reclasses the path is the join class up to Lv 20 (40 on the special
  track). A path that never leaves a base class dims the whole listing to 40% (no stat colouring)
  except its open button.
- **Favourites**: the Roster / Chart / character-header favourite is a **heart** (v3.3); stars are
  reserved for class favourites (Profile) and parent favourites (Parents tab).
- **Row** (padding 12/10, `--line` bottom border). Left side: PortraitChip 32, ClassSprite, name,
  and a favourite star (filled `--ink` / outline `--ink-3`; tap toggles). The sprite has no chip
  background and opens the class popup. Right side, gap 6: the S, A+ and pair-up RelationSlots
  (**child rows get a fourth
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
  **Avatar** (Corrin only), **Profile**, **Stats** and **Progression**; second-generation units also
  have a **Parents** tab. The default is Profile.
- **Panel**: white, with a `--r-sheet` top radius, overlapping the splash by about 78px. Opening
  a character slides the page in from the right (460ms, no fade) and starts at the top.
- **Mobile layering**: the character page is a fixed, scrolling layer over the screen it was opened
  from (Roster or Chart), which stays mounted and `inert` underneath. Closing it — including iOS's
  edge swipe-back, which previews a snapshot of that screen — reveals it unchanged, with no re-render
  or scroll jump.
- **Sticky header**: a zero-height sticky rail at the very top of the page holds a white header —
  back button, the name (21/700), then the tab pills — that slides in (340ms, ease-out) once the hero
  tabs scroll away and slides out (240ms, ease-in) when they return, pinned to the top throughout.
  Spacious margins (12/16px, plus the top safe area). Switching tabs preserves scroll.
- **Swipes**: the tabs sit side by side in one strip and stay mounted once shown (the opening tab
  renders first, the rest just after the page has slid in), so a drag reveals the neighbouring tab's
  real content. The strip follows the finger and eases to the chosen tab over 380ms (a failed swipe
  springs back at the same pace); a swipe commits past 48px or on a quick flick. The panel takes the
  active tab's height. Swipes starting within 24px of the left edge are left to the system back
  gesture, and horizontal scrollers (pill rails, tab rails, the talent carousel, form controls) keep
  their own gestures. The Roster swipes between stat lenses with the same thresholds, sliding every
  row's stat table.
- **Relationships**: each filled card has a white rounded-square "open" button top-right (Figma
  `3:4136`) that opens that character. Corrin's A Rank holds several partners: one shows the normal
  card; 2–4 a 2×2 grid of busts; more a larger grid (3×3, …) of face crops, with square cells and
  spare cells in the slot hue; the caption becomes "Gains multiple" (full list as its label/tooltip).
  Below the grid, **Children** (or, for a child, **Parents**) link rows open those characters.

### Avatar tab (`3:5890`) — Corrin only

- The tab opens with the same top margin as the other tabs (30px).
- **Gender**: two square cards side by side (gap 10, `--r-md`) showing the male and female Corrin
  promo art. Selected: 4px `--accent-strong` border, dark base, black gradient, white label.
  Unselected: 1px `--line` border, 56% opacity, white gradient, `--ink` label. The selection
  cross-fades the splash art (600ms) to the other Corrin on the same page. **Each gender keeps its
  own plan** — boon, bane, talent, relationships, classes, progression and skills; the inactive one
  is kept but has no effect. Switching back restores the old marriage and pair-up if the partner is
  still free; a partner taken meanwhile shows greyed with a one-line notice in place of "Gains X".
  The favourite star, name and hair colour are shared.
- **Name**: a text field (placeholder "Corrin") whose value replaces "Corrin" everywhere
  (commits on blur / Enter).
- **Hair colour**: a row with the current swatch and a chevron; it opens a sheet with a 64px
  preview sprite and the game's 30 swatches as rounded-square chips (`--r-sm`), 10 columns × 3 rows,
  6px gap (selected: 2px accent outline), read from the ROM's colour table. The default is the
  first swatch (white, `#f6f4ef`). Map sprites
  follow it — Corrin's, and every child whose variable parent is Corrin; other children take their
  variable parent's hair colour (the Parents tab shows each candidate's colour on the child's
  sprites).
- **Boon** / **Bane**: a 4×2 grid of chips (`min-width 73px`, `--r-xs`) with a name and a
  `(Stat)` line. Boon chips use a `--good-soft` outline and `--ink-2` text; the selected boon is
  `--good` fill with white text. Bane chips use `--bad-soft` / `--bad` the same way. The stat held
  by the other grid is greyed but still tappable: picking it swaps the two (+Spd/−Lck, pick +Lck →
  −Spd).
- **Talent**: a horizontal scroller of 102px square cards (gap `--s2`, as the boon/bane grid),
  each showing the tree's base and promoted ClassSprites overlapped by −12px, plus the tree name.
  The selected card is `--accent-strong` fill with white text; the rest are `--line` outline with
  `--ink-2` text. Sprites use Corrin's head for the current gender. Scrolling it never swipes tabs.

### Profile tab (`3:5891`)

- **Relationships** (21/700): three equal columns, **S Rank**, **A+ Rank** and **Pair Up**. Each
  has a 14/600 label and a card about 114px tall: a talk-portrait bust crop with the name overlaid
  bottom-centre (white, 14/700, shadow) and a 1px border in the slot hue. Empty cards show the slot
  glyph on `--surface-2`. The caption below is italic 12px `--ink-2`: "Gains *Class*" for S and A+
  (the class the Partner or Friendship Seal unlocks); for Pair Up it's a **Front / Back**
  Segmented. Children choose their variable parent on the separate Parents tab, which writes the
  fixed parent's S slot.
- **Corrin's middle column is "A Rank"** (glyph `A`): Corrin can't hold an A+ rank but can Friendship
  Seal into any same-gender A-rank partner's class. The slot is a multi-select set: the picker toggles
  partners without closing (Clear / Done), the card shows the first partner as "*Name* +N", and the
  caption lists every class gained. Only planned partners join Corrin's class pool. The Roster slot
  shows the first partner with a "+N" corner badge in the slot hue, and the pair-up picker floats
  them up with an "A rank" badge.
- **Classes**: the heading with a Base / Advanced / All Segmented on the right, then a pill
  StatLensRail of class-relevant lenses (Base Stats (Class), Max Stats (Effective), Growth Rates
  (Class), Growth Rates (Effective), Pair Up Bonuses (Class), Pair Up Bonuses (Effective)). The rail
  is sticky under the sticky character header (with a 1px `--line` bottom border) while the class
  cards scroll past.
  Category labels appear on the rail; section headings omit the category. **Class cards** (`--r-md`,
  `--line` border) show the sprite, class
  name (14/700), a favourite star top-right and the StatTable. Starred classes are listed first
  (per unit, always on) and lead the Stats tab's class rail with an inline star. Tapping a card
  selects it: `--accent-strong` fill, white text and a "SELECTED" tag. Selection sets the unit's
  current class (the same field as the Roster class popup).
- **Skills** (Figma `3:4348`): the personal skill first (locked card), then five equip slots. A
  skill the plan doesn't reach carries an inset notice under the card: **yellow** "Not in
  progression: *Class Lv N*" (`--warn-tint` / `--warn-ink`) when a class the unit already has teaches
  it; **red** "Not accessible: *Class Lv N*" (`--bad-tint` / `--bad-ink`) when it needs another
  relationship, listing the portraits that would unlock it ("Via S Rank", "Via A+ Rank" — "Via A
  Rank" for Corrin — and "Via Parent") and "Can be inherited from *Name*". A child's skill only a
  parent can pass on reads "Only inheritable … Inherit from *Parent*". Tapping a slot opens the
  skill picker. An empty slot shows a dashed placeholder, a `+` icon in the round icon well, and "Empty slot".

### Parents tab — children only

Figma `15:1542`. **Parent A** is a link row (portrait, name, arrow → their page). **Parent B** lists
the fixed parent's possible spouses (first-generation only, except Kana: Corrin can marry into the
second generation) with a sort button (SortIcon) opening a sheet: Recruit order, Name, each stat of
the inherited modifiers and growths, direction, and a "Show the child's resulting values" toggle.
Cards are stacked in one bordered list: portrait, name, favourite star and the inherited class
tree's sprites (drawn as **the child**) on the right; then availability — italic `--ink-2` when the
candidate joins before Parent A, otherwise with a bold "(+N chapters)" delta; then three 8-column
tables (no Mov): inherited stat modifiers, growths and pair-up bonuses. By default these show the
**parent's own contribution** (their modifiers, their personal growths, their B + S pair-up rows);
the toggle switches to the child's results. The chosen parent's card inverts to `--accent-strong`.
The star on a card is a **parent favourite**, saved per child and separate from the Roster heart:
starred candidates are always listed first (like class favourites), then the chosen sort.

### Stats tab (`3:5892`)

These are sections of labelled StatTables with `--line` dividers between sections:

- **Effective**: Effective Growth Rates, Max Stats, Effective Pair Up Bonuses.
- **Personal**: Stat Modifiers, Personal Growth Rates, Personal Pair Up Bonuses.
- **Class**: a pill rail of the unit's classes (defaults to the current class; this selection only
  changes what this section shows), then Base Stats, Class Growth Rates and Class Pair Up Bonuses.
  Class comparisons are limited to the selected class's tier. Every stat lens uses dynamic low /
  average / high coloring against its available comparison set (`colourReferenceClassIds`: Class
  lenses against every playable class of the same tier; Effective lenses against the unit's own
  classes of the shown class's tier; Personal lenses against the army), applied to the value's text
  (bold) — cells keep their neutral fill. `-` placeholders (no value) use `--ink-2`. Mov is a value only in Max Stats and Base Stats; the
  other lenses show `-` there.

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

- A **Recruitment** section comes first: join chapter and class with the skills held on recruitment
  as chips directly underneath (the only place several skills arrive at once); that two-line block
  is vertically centred against the join level on the right. Paralogue, Xenologue, DLC and "or
  later" recruits get a numeric **Lv** field (16px text, commits on blur/Enter) because their join
  level depends on when they're recruited; others show the fixed level in `--ink-2`.
- For **children**, an **Inherited Skills** section sits after it: two SkillCards, one per parent,
  side by side from 720px. Empty: "Tap to choose a skill from *Parent*" (`--ink-2`, with only the
  parent's name in the tag token: 600, `--accent-strong`; "Parent B" until one is chosen). Filled:
  the description plus "From *Parent*" styled the same way.
  Each opens the skill picker limited to that parent's inheritable skills; a skill already taken by
  the other slot is disabled ("From other parent"). Inherited skills also appear in the child's
  equip-slot picker. Directly under the heading, equipped skills that only a parent can pass on and
  that aren't inherited yet are listed with their notice.
- **Not in Progression** (just above the first segment): equipped skills the planned path doesn't
  teach, each with its yellow or red notice.
- The page is split into **segments**, one per class tier the route passes through: Base (1–20),
  Advanced (1–20), Special (1–40), plus Eternal Seal extensions (+5 each). A segment only
  exists while the route needs it. Each segment has a 21/700 heading, then **one row per level**:
  the level number (14/700), the skill learned at that level (icon + name; at most one per
  level-up), a
  dotted leader line, an **info button**, and a **reclass dropdown** (`--surface-3`, `--r-xs`, 12px;
  the placeholder is italic "No reclass").
- A reclass chosen at level *n* takes effect from level *n*. The rest of that segment recomputes
  (skills learned, levels remaining). A class change grants no skills itself: its skills arrive on
  later level-ups (docs/DATA.md › Progression). Choosing a promoted class **ends the segment** and starts the
  Advanced one at 1. Base↔base and promoted↔promoted keep the level. Special-class and DLC rules
  come from `src/logic/classRoute.ts` (Master Seal ≥ 10, level carry/convert, Eternal Seal +5).
  Invalid picks are not offered, and later rows made invalid by an earlier change are cleared with
  a toast ("Removed 2 later reclasses").
- **Info panel**: the info button toggles a full-bleed `--scrim` panel under the row, with a caret
  pointing to the button. It shows *Expected Stats* (average stats at that level on this path),
  *Effective Growth Rate* (for the class at that level) and *Effective Pair Up Bonuses*. The
  StatTables use inverted tones (white headings). Only one panel is open at a time.
- The start level comes from the recruitment data (join level and class per route), overridden by
  the plan's recruitment level for variable-level recruits.

## Chart (`3:10134`)

- The "Chart" title and sort button in a sticky white header (as the Roster's, no shadow; a 1px
  `--line` bottom border fades in over 150ms only once the page has scrolled), with an underline
  tab rail like the Roster's: **Full**, **Skills** (default), **Progression**, **Skills + Pair Up**.
  Then a list of cards (`--line` border, `--r-lg`, gap 20, padding 10; rows have 4px left padding).
  Map sprites render at whole-number scales only (32px = 1×), so Chart and Roster sprites are 32px.
- Tabs: *Skills* shows each row's skill icons; *Progression* adds a grey inset with the compact
  class path ("Lv 1: Nohr Princess → Lv 10: Samurai → Lv 12: Swordmaster → Lv 15: Master of Arms":
  the join class, then each class change at the level it's taken); *Skills + Pair Up* shows skills
  for leads and solo units, and the back unit's **Effective Pair Up Bonuses** table instead (at the
  pair's actual support rank — A but not S means no S bonus); *Full* shows skills, path and pair-up
  bonuses for everyone. The swap button sits on the divider between the two rows.
- A sort button opens its own Recruit / Name / Stat sheet with direction, a **Show** filter (All /
  First gen / Children), Favourites-first and Link pair-up partners; these settings do not share state with the Roster. Class sprites have no chip
  background and sit between the portrait and name.
- A **pair card** has two rows, front on top. Each row has a ClassSprite chip (24), name (21/400),
  a favourite star, the unit's **five equipped skill icons** (20px, gap 5) and an edit arrow (20px)
  that opens the Character page. A **swap button** (`charm:swap-vertical`, on a white knockout
  over the divider) swaps front and back, which rewrites both units' pair-up roles.
- A **solo card** is a single row for any in-army unit with no pair-up partner.
- Order follows the Chart sort. Linked pairs are positioned at the first partner in sort order,
  while the front member remains the top row.
- Desktop: two-column grid of cards.

## Screens not in Figma (intuited — owner notes 1–2)

### Runs (bottom-nav tab)

- The "Runs" title, then a list of run cards. Each card uses a standard 1px border tinted with the
  route accent (never a left border stripe), the run name (21/400), a subline "Revelation · 5 mods ·
  DLC on · 34 units", and a "More"
  menu (Duplicate, Export JSON, Share link, Delete with confirm). The active run shows an
  `--accent-strong` "ACTIVE" tag; tapping another run switches to it.
- Footer actions: **New run** (primary, `--accent-strong`) and **Import** (outline).
- Per-run **Mods** checklist: UGF is mandatory until a vanilla dataset is integrated; optional
  installed mods can be toggled and saved with the run.

### New-run setup (full-screen flow, three steps with a progress bar)

1. **Name + mods**: a text field and the Mods checklist (UGF required).
2. **Route**: three large cards (Birthright / Conquest / Revelation) with a standard border tinted
   with the route hue; selected state uses the route accent. Conquest is the default. Includes a
   **DLC** switch. Selecting a route immediately previews the accent
   across the flow.
3. **Your Corrin**: the Avatar tab component reused as-is (gender, boon, bane, talent).

Then "Start planning" lands on Roster. First launch with no runs goes straight into this flow.

### Pickers

- **Character picker** (S / A+ / pair-up / parent B): a sheet titled "S Rank for Corrin". It has a
  search field, then a 4-column grid of portrait cards (name below). Each card carries badges from
  the build's support graph: support speed (fast), and "Taken" when the candidate is already in
  another relationship of the same kind (still selectable; confirming shows what gets unlinked).
  Candidates that the graph disallows for this slot are hidden. A "Clear" action is in the header.
  Order: current S then A+ partners first (pair-up, with an "S rank" / "A+ rank" badge), then recruit
  order as the Roster shows it: every first-generation unit before any child.
  S and A+ show the "Gains *Class*" line under each candidate.
- **Class popup**: classes available to the unit, grouped by source (Own, Parent, Partner Seal,
  Friendship Seal, Talent, DLC) as sprite + name rows. The current class has an accent check.
- **Skill picker** (equip slots): every skill the unit could hold in this run — including ones
  needing a relationship that isn't set; gender-locked and route-locked classes and skills no
  possible partner provides are left out. Medium (17/700) group headings in order: **In
  progression**, **Not in progression**, **Inheritable only** (children), **Not accessible**. Within
  each group (group headings stick to the top of the sheet while their group scrolls), small headings per teaching class with its ClassSprite and a collapse chevron
  (collapsed state saved per unit). Each class heading has **one** grey notice under it (class
  name, no level; the inheritable one reads "Only inheritable from *Parent*: *Class*"), listing every
  way in across its skills — acquisition guidance only, so "Not in progression" classes get none; the
  skill cards themselves only carry their learn level ("Lv 10") as a tag. Classes that only a
  *combination* opens list it as "Only together: S *Jakob* & A+ *Elise*". A skill
  equipped in another slot is muted ("Equipped · tap to swap") and picking it swaps the two slots.
  The inherit-slot pickers keep the simple list of that parent's inheritable skills.

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
| Sort icons | glyph + shared arrow (down = ascending) | Figma clock (recruit) and `mdi:sort-alphabetical` letters (name) kept from the originals; stat glyphs (owner-chosen): `material-symbols:favorite` HP, `material-symbols:swords` Str, `material-symbols:magic-button` Mag, `ri:target-fill` Skl, `game-icons:fluffy-wing` Spd, `ph:clover-fill` Lck, `material-symbols:shield` Def, `ph:flower-lotus-fill` Res, `griddy-icons:steps-filled` (mirrored) Mov — `src/components/SortIcon.tsx`, licences in docs/ASSETS.md |

Everything must still render with `VITE_ASSETS=off`: monograms for portraits and sprites, a
route-hue gradient for splash.

## Owner clarification notes (verbatim)

> note 1: the run setup and selection pages have not been defined; you may intuit these based on the designs provided.
> note 2: the designs supplied are mobile only; please intuit desktop designs based on these.
> note 3: colours are used in this design without regard for consistent tokens. please use consistent tokens across the design for colours. for active selections, please use an accent colour that reflects the chosen route (br/cq/rev)

Per-screen notes are folded into the sections above; the original file is attached to the
2026-09-29 overhaul request.
