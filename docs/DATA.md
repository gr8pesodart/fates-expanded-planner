# Data pipeline

Everything the planner knows comes from **the exact build being played** — the modded workspace at
`../3ds-games/fe-fates/` plus the game's own tables. This document records what is extracted, how,
and what is still open.

## What's in the packs

| Data | State |
|---|---|
| Support graph (UGF: who supports whom, marriage vs platonic, speed, thresholds) | ✅ `supports.json` |
| Units (71 playables: English names, bases, growths, cap mods, class sets, personal skills, route availability, DLC flag, fid) | ✅ `units.json` |
| Classes (135: 129 vanilla jobs plus six mod jobs; growths, caps, pair-up, class skills, learn levels, promotions, movement, DLC flag, jid) | ✅ `classes.json` |
| Skills (229: names, in-game descriptions, icon index, DLC-only flag) | ✅ `skills.json` |
| Child rules (fixed parents, growth averaging, cap-mod combination, class inheritance) | ✅ in `src/logic/` |
| Pair-up bonuses (class bonuses + per-unit C/B/A/S support bonuses) | ✅ in the packs (rule sourced below) |
| A+ (friendship) exact partner tables | ⚠️ derived (same-gender, same-generation edges with an open 4th rank; one-way choice) |
| Current support rank in the saved plan | ⚠️ final S/A+ decisions only; pair-up assumes C when neither is selected |
| Assets (class sprites, skill icons, face icons) | ✅ `public/assets/` + `src/data/assets.json` (docs/ASSETS.md) |

## Support pack — `tools/extract/extract_ugf_supports.py`

**Source:** `work/mods/unofficial-gay-fates/.../Paragon Imports/UGF.json` (the mod author's own
Paragon export, UTF-8, clean PIDs). Writes `characters.json` (71) and `supports.json` (2,463
pairs, raw type ints). Decode: `S<<24 | A<<16 | B<<8 | C` point thresholds; `0xFF` locks a rank.
`0x140E0904` romantic, `0xFF0E0904` platonic, `0x120C0703` fast romantic, `0xFF0C0703` fast
platonic. Decoding lives in `src/data/types.ts`.

Regenerate: `python tools/extract/extract_ugf_supports.py`.

## Unit/class/skill packs — `tools/extract/extract_game_data.py`

**Source:** vanilla `work/cia-extract/romfs/GameData/GameData.bin.lz`, decompressed with
`fe-fates/tools/fe_tools/lz13.py`. Table layouts and ID→name lists come from RainThunder's
[fefates-tools](https://github.com/RainThunder/fefates-tools) Nightmare modules (enum lists are
cached in `tools/extract/sources/`, gitignored; the script downloads them if missing). Skill
descriptions come from the game's own English message archive
`work/cia-extract/romfs/m/@E/GameData.bin.lz` (UTF-16 text archive, same key space as the
GameData message keys).

Table offsets (absolute in the decompressed file; the script resolves them from the GameData
header pointers and fails if they move):

| Table | Offset | Entry | Fields used |
|---|---|---|---|
| Characters | `0xDF0` | 255 × 152 | name ptr (+8), fid (+12), gender flag (byte 0), support route (+38), classes (+44/+46), level cap (+134), bases (+56), growths (+64), cap mods (+72), weapon ranks (+96), skills (~+104), personal skills (+116/118/120), reclass options (+124/126), fixed parent cid (+42), guard-stance bonus pointer (+32) |
| Classes | `0xEA10` in vanilla; installed build pointer in header | 129 vanilla + six appended mod jobs, each 128 bytes | jid (+8), name ptr (+16), bases (+28), growths (+36), caps (+52), pair-up (+60), weapon ranks (+68), class skills (+84…90), movement (+93), promotions (+100/+102), base classes (+104/+106), DLC index (+123) |
| Skills | `0x12BBC` | 229 × 32 | seid (+0), name message key (+4), description message key (+8), id (+16), icon index (+20) |

Notes:

- Strings resolve at `pointer + 0x20` (BinArchive data-space offset), Shift-JIS. Character name
  strings are `PID_<japanese name>` — the same key space as the support pack, so joins are exact.
  Message keys (`MSEID_*`, `MJID_*`) resolve against `m/@E/GameData.bin.lz`, a BinArchive whose
  data section holds labelled null-terminated UTF-16LE strings.
- Vanilla tables are used deliberately: the installed build's UGF changes touch supports only, not
  unit stats/classes (docs/MODS.md). The merged GameData relocates later tables, so don't read
  class data from it without re-locating.
- English names are slot/index lookups into RainThunder's lists; the game itself stores Japanese
  internal names. The script cross-checks the message archive's own English names for every skill
  and reports mismatches (currently 0).
- Growths/stats/caps were cross-validated against a community calculator's published values
  (Shiro, Asugi, Selkie, Ryoma, Gunter all match exactly).
- **DLC classes** carry a DLC index at record +123 (`0..7` = Dread Fighter, Dark Falcon,
  Ballistician, Witch, Lodestar, Vanguard, Great Lord, Grandmaster; `0xFF` = not DLC). **DLC-only
  skills** are computed as the skills taught exclusively by those classes, plus the personal skill
  of a DLC unit. **Anna** is the only DLC-only playable unit (`PID_アンナ`, recruited through the
  “Anna on the Run” xenologue) — no unit table flag exists, so she is a curated one-entry list with
  that source.
- **Route availability** is the character table's support-route byte: `1` Birthright only
  (Yukimura), `2` Conquest + Revelation (Gunter), `3` Birthright + Conquest (Izana), `4`
  Revelation only (Fuga), `5` Birthright + Revelation, `6` Conquest + Revelation, `7` all routes.
  Cross-checked against Fire Emblem Wiki / Fandom route lists (Yukimura Birthright-only, Izana
  Birthright+Conquest, Fuga Revelation-only, Gunter Conquest+Revelation).
- **Pair-up support bonuses** are read 40 bytes after each character's guard-stance bonus pointer:
  four C/B/A/S rows of eight stats. Verified against Serenes Forest's published pair-up tables
  (Felicia, Ryoma, Takumi spot-checks match exactly). The 40-byte block at the pointer itself
  (named `GuardStanceBonuses` by FE14 modding tools) has unconfirmed semantics and is not exposed.
- The class table's `pairUp` array holds the class pair-up bonus granted when the class is the
  support unit (Serenes Forest “Pair Up Stats” per class).

Regenerate: `python tools/extract/extract_game_data.py` (needs the fe-fates workspace; override
paths with `--gamedata`, `--fe-tools`, `--sources`, `--messages`).

## Recruitment (v3) — `tools/extract/curated/recruitment.source.json` → `recruitment.json`

Per route, the recruit order, join chapter, join level and join class for every available unit
(the roster's default sort and the progression screen's start point). The hand-curated source
lives in `tools/extract/curated/recruitment.source.json` (every entry cites its source page);
`build_recruitment.py` validates it against the pack's `units.json`/`classes.json`, sorts each
route and writes `src/data/packs/ugf-2.5.2/recruitment.json`. Regenerate:

    python tools/extract/build_recruitment.py

Sources: Serenes Forest [Hoshidan](https://serenesforest.net/fire-emblem-fates/hoshidan-characters/recruitment/) /
[Nohrian](https://serenesforest.net/fire-emblem-fates/nohrian-characters/recruitment/) /
[Revelation](https://serenesforest.net/fire-emblem-fates/revelation/character-recruitment/) /
[Other/DLC](https://serenesforest.net/fire-emblem-fates/other-characters/recruitment/) recruitment
tables (chapter, order, exclusivity) and the matching base-stats pages (join level/class);
the [DLC list](https://serenesforest.net/fire-emblem-fates/miscellaneous/downloadable-content/)
(Dragon's Gate opens after Chapter 6, so Anna's "Anna on the Run" xenologue sits at 6.5);
[Fire Emblem Wiki › Paralogue](https://fireemblemwiki.org/wiki/Paralogue) and
[Dragon Blood](https://fireemblemwiki.org/wiki/Dragon_Blood) (all child paralogues unlock after
Chapter 7 + the fixed parent's marriage; Birthright's Paralogue 6 also needs Chapter 15 and Kaze's
A support); [Fire Emblem Wiki](https://fireemblemwiki.org) character pages for route confirmation.

Rules:

- `chapterSortKey` = chapter number; recruits whose unlock follows a chapter sit at `chapter + 0.5`
  (Mozu 7.5, Anna 6.5) or at their My Castle chapter (Izana/Flora 19 or 23 by route, Fuga 19,
  Yukimura 23). Same-key units keep source order (stable sort) = in-game join order.
- Children share 7.5 (Chapter 7 + marriage) and keep paralogue order (P2–P22); the app additionally
  lists all second-gen after first-gen (`src/logic/rosterSort.ts`). Child join level is 10 (it
  scales with story progress in-game).
- `optional` = must be actively obtained: Mozu, Anna, the My Castle recruits (Izana/Fuga/Yukimura/
  Flora), Shura (spare him) and all children. Route counts: 44 Birthright / 43 Conquest / 69
  Revelation.
- The builder resolves the source's English class name through the unit's gender variant
  ("Swordmaster" → "Swordmaster (M/F)"), fails on unknown units/classes, wrong `promotedAtJoin`
  tier flags or duplicates, and warns when a curated route disagrees with `units.json` routes.

Discrepancies found while curating (units.json/extractor left untouched):

- **`units.json` routes vs sources: no mismatches.** Every curated unit appears on exactly the
  routes the source pages list (builder warnings = 0; pinned by `src/data/recruitment.test.ts`).
- **Scarlet (Revelation)**: recruited in Chapter 16, but permanently leaves the army at the end of
  Chapter 18 ([FE Wiki](https://fireemblemwiki.org/wiki/Scarlet)); the pack lists her as a normal
  Chapter 16 recruit and only the note carries the caveat.
- **Mitama's join class**: Serenes' Revelation base-stats table says Priestess (promoted); the
  Birthright table and the extracted class pool say Shrine Maiden (base). The pack uses Shrine
  Maiden.
- **Mozu's paralogue**: FE Wiki says it unlocks after Chapter 7; some third-party guides say
  Chapter 8. Used 7.5.
- **Felicia/Jakob**: only the servant matching Corrin's gender joins in Chapter 6; the other joins
  after Chapter 15 at level 13. Both are placed at Chapter 6 (earliest permanent join) with the
  condition in the note. **Kaze (Birthright)** is at Chapter 4 but leaves after Chapter 15 without
  Corrin's A support (noted).
- **Yukimura's chapter**: Serenes and FE Wiki say Chapter 23 or later, Fandom says 22. Used 23.

## Pair-up mechanics (sourced)

The planner composes a pair-up bonus as:

1. **Class bonus** — `classes.json` → `pairUp` (8 stats, HP always 0; movement is display-only).
2. **Support bonus** — `units.json` → `supportBonuses`, the C/B/A/S rows for the supporting unit.
   Rows are additive increments and cumulative: a pair at A receives C + B + A (Serenes Forest:
   “The stats for each support level are cumulative”), an S-ranked pair adds the S row.

Sources: Serenes Forest's Fates pair-up stat pages
(<https://serenesforest.net/fire-emblem-fates/hoshidan-characters/pair-up-stats/> and the Nohrian /
Other equivalents) for the per-character tables, and Fire Emblem Wiki's *Pair Up* article for the
component breakdown. Stats themselves were read from the game file; the community tables were used
only to verify the decode.

Known open item: second-gen units store empty (all-zero) support-bonus rows. Serenes Forest
documents that children inherit their parents' rows (C: father's C, B: mother's B, A: father's A,
S: mother's S); implementing that combination rule belongs to the pair-up feature, not extraction.
The current planner therefore does not include inherited support rows in child pair-up projections.

## Mechanics implemented (src/logic)

- `classes.ts` — class families, gendered variants, branch chains, and the class-pool rules:
  - first gen: own class A and class B branches; children start with their own branch
  - the promoted class paired with a character's class A is part of that line, not another branch.
    Fates promotions can have multiple source classes (Merchant promotes from Villager and
    Apothecary), so derive A from the unit's primary class line and B/C from `reclasses`. Serenes
    Forest's [class-set tables](https://serenesforest.net/fire-emblem-fates/nohrian-characters/class-sets/)
    list Laslow as Mercenary/Ninja and Selena as Mercenary/Sky Knight. Their raw promoted companions
    (Hero and Bow Knight) also promote from Fighter and Outlaw respectively; treating those records
    as independent branches incorrectly gave Laslow Fighter and Selena Outlaw. Mozu's Apothecary is
    hidden alternate A; her actual reclass is Archer. All three cases are pinned in `classes.test.ts`.
  - child inheritance checks the father first and mother second, independent of the app's fixed /
    variable parent fields. Each parent passes the first eligible class in A → B → alternate A →
    alternate B order. A class already in the child's pool is skipped; Songstress is never passed.
    The alternate-class mapping is the one documented for Fates class sharing and inheritance.
  - **Shigure + Jakob**: Jakob passes Troubadour as Shigure's class B. Azura then passes Wyvern Rider:
    her Songstress is locked, Sky Knight is Shigure's own class, Troubadour is already inherited,
    and Wyvern Rider is her alternate B. The reference explicitly lists “Wyvern Rider, inherited
    from Azura” ([GameFAQs child inheritance guide](https://gamefaqs.gamespot.com/3ds/114533-fire-emblem-fates-conquest/faqs/72752)).
  - **Nina + Nyx**: Niles passes Dark Mage after Nina's own Outlaw conflicts. Nyx's Dark Mage and
    Outlaw also conflict, so her alternate A, Diviner, is the first available class. Fire Emblem
    Wiki says Nyx “grants her tertiary class, Diviner” ([Nina class inheritance](https://fireemblem.fandom.com/wiki/Nina)).
  - class sharing for Partner and Friendship Seals checks the donor's A → B → alternate A sequence;
    unique class A values (Nohr Prince(ss), Songstress, Villager, Kitsune, Wolfskin) advance to B,
    and a candidate matching the recipient's own class A advances once more. Corrin and Kana use
    the donor's alternate B as the final candidate. This means Jakob's A+ with Silas resolves to Cavalier,
    even though Jakob already has Cavalier as class B; it must not fall through to Mercenary.
    The guide's exact example is “Jakob gets Cavalier from Silas” ([class sharing examples](https://gamefaqs.gamespot.com/3ds/114533-fire-emblem-fates-conquest/faqs/72752)).
  - Corrin's chosen talent is class B. Kana's Nohr Prince(ss) class A conflicts with Corrin's, so
    Kana inherits the talent when it is available; a child with Corrin as the variable parent gets
    Corrin's Nohr Prince(ss) class A instead. Seal partners of Corrin receive the first eligible
    class from Corrin's class slots, skipping the unshareable Nohr Prince(ss).
  - UGF same-sex parent pairs have no vanilla inheritance order. The planner keeps fixed-parent
    before variable-parent order for those pairs as a deterministic fallback.
  - A+ supports are one-way and Corrin can neither give nor take one (Fire Emblem Wiki › Support:
    "unlike other supports, they are not mutual"; "Units cannot unlock A+ supports with Corrin")
  - Corrin's Friendship Seal works with any same-gender A-rank partner, not one A+ partner (Fire
    Emblem Wiki › Friendship Seal). The plan stores the ones the player intends to reach
    (`UnitPlan.friendshipPartners`, Corrin only); each still-eligible one (same gender, reaches A,
    on the roster) contributes a branch
  - Nohr Prince(ss) promotes to Nohr Noble on Conquest, Hoshido Noble on Birthright, either on
    Revelation (`progression.ts`)
- `stats.ts` — `stats = personal bases + class bases`; `growths = personal + class` (personal
  includes boon/bane for Corrin); `caps = class caps + personal cap mods` (HP exempt); children:
  `growths = floor((child + variable parent) / 2)`, `cap mods = fixed + variable (+1 unless the
  variable parent is a child)`.
- `skills.ts` — inheritable skills (`inheritableSkillPool`, sourced: Fire Emblem Wiki ›
  Inheritance and › Kana): a child inherits **one skill from each parent**, the lowest eligible
  equipped skill, so the plan stores two picks (`inheritFixedSkill`, `inheritSkill` = Parent B).
  Never inherited: personal skills, DLC skills, Songstress skills. Unverified: what the game does
  when both parents pass the same skill (the planner blocks the duplicate).
- `skills.ts` — learnable pool with source labels; levels 1/10 (base), 5/15 (promoted),
  1/10/25/35 (special); five equip slots.
- `family.ts` — children of a pair: units whose fixed parent is either partner (Corrin couples
  produce Kana plus the spouse's child).

### v3 planner rules (`army.ts`, `lenses.ts`, `progression.ts`, `relationships.ts`)

- **Roster** — units on the run's route (plus DLC Anna when her map is on), only the Corrin matching the
  chosen gender and that Corrin's Kana. Children are always listed.
- **Relationships** — S and pair-up are exclusive and mutual. A+ is a one-way choice: picking
  Jakob as Ryoma's A+ does not set Jakob's, and several units may pick the same partner. A child's second parent is never
  stored: it *is* the fixed parent's S partner, so the roster/profile "Parent B" slot writes
  through to that S bond.
- **Corrin per gender (v3.3, `corrin.ts`)** — Corrin (M)/(F) and their Kana keep separate plans,
  and boon / bane / talent live in `run.corrin.builds[gender]`; name and hair colour are shared.
  Switching gender releases the leaving pair's S / pair-up partners (only the partner's side is
  cleared) and restores the arriving pair's stored bonds where the partner is still free. A partner
  taken meanwhile leaves a one-sided link: `relationships.ts › bondPartner` treats only mutual
  links as real, so it grants nothing and the Profile shows it greyed. The favourite star moves to
  the active Corrin / Kana. Schema 4 saves migrate by copying the old single Corrin onto both
  genders (classes re-sexed; bonds the other gender can't hold dropped) — `expandLegacyCorrin`,
  run once the dataset is loaded.
- **Candidates** — S / Parent B: romantic edges of the subject in the build's graph. A+
  (`army.ts › aPlusEligible`): **same gender**, edge with an **open 4th rank** (the game reads a
  pair's 4th rank as A+ for same-gender pairs and S otherwise; a locked 4th rank — siblings — caps
  at A), **same generation** (owner ruling 2026-10-01), **not the unit's S partner** (owner ruling
  2026-10-01), never Corrin. A stale pick that fails any of these grants no class. Pair-up: anyone
  on the roster (rank only changes the bonus).
- **Pair-up rank** — S between spouses, otherwise the highest non-S rank the edge allows (A+ pairs
  fight at A); no edge → class bonus only.
- **Lenses** — "Stat Modifiers" = personal cap mods (+ boon/bane, child rule); pair-up lenses and
  modifiers have no HP value (rendered `-`, unsortable). "Expected Final Stats" = the last row of the
  planned progression (no reclasses → join class to Lv 20, or 40 on the special track) plus that
  class's Mov; a path that never leaves a base class is flagged (`progression.ts › expectedFinal`).
- **Skill access (v3.3, `skillAccess.ts`)** — every skill a unit could hold in the run, classified in
  order: learned on the planned path (or chosen to inherit) → taught by a class the unit has now →
  only inheritance gives it (a current parent, or - v3.4, owner - another possible second parent
  when no relationship would teach it; a parent's class is read in the child's gender unless that
  version doesn't teach the skill) → needs a relationship not in the plan (each roster S
  partner, A+ partner — Corrin: same-gender A-rank partner — and, for children, each other possible
  second parent tried one at a time on top of the current plan, plus what those parents could pass
  on). Each candidate relationship resolves its own class-sharing slot; another relationship does
  not make that slot fall through to a different class. `npm run audit:skills`
  (`tools/audit/skillCombos.audit.ts`) brute-forces every second parent × S × A+ combination
  (Corrin: S × up to two A-rank partners) on every route and both Corrins and must report 0
  unlisted skills.
  Everything else is **unavailable**, by class (no reason given; DLC classes are omitted while their
  map's toggle is off). Classes are also tracked on their own (`ClassAccess`: a class's first status and
  ways in), which the picker's Grouped view lists whole. Route-locked and gender-locked classes come out of `classPool`/`classOnRoute` as everywhere
  else; skills nothing in the run gives are not listed. Picker filters (`SkillFilters`, per unit):
  `s` / `a` drop new S / A+ candidates, `p` drops other second parents once one is chosen.
- **Children's recruitment chapter (v3.4, `logic/childRecruit.ts`)** - children pick the main-story
  chapter (story position: the chapter to be played next) their paralogue is done at
  (`UnitPlan.joinChapter`). Earliest = the later of the parents' recruitment chapters (a parent who
  is a child counts by their own earliest chapter; owner rule), never before child paralogues open
  (after Chapter 7; Birthright Paralogue 6 also needs Chapter 15). Join level by position (Fire
  Emblem Wiki › Fight or Flight scaling; GameFAQs Conquest board 73313117: "Chapter 13 14 / Chapter
  14 15 / Chapter 15 17 / Chapter 16 18 / Chapter 17 20"): Lv 10 through Chapter 11, 12 → 11,
  13 → 12, 14 → 14, 15 → 15, 16 → 17, 17 → 18, 18+ → 20. Same on every route (a forum-only
  Birthright chart disagrees; unconfirmed). Parents' levels don't change the join level.
- **Offspring Seal (v3.4)** - children recruited from Chapter 19 join at base Lv 20 carrying one (Fire
  Emblem Wiki › Offspring Seal: "will not appear if recruited from chapter 18 or earlier"). It promotes
  the **starting base class** to one of its promotions at advanced Lv 2 × (chapter − 18): Chapter 19 → 2
  … 27 → 18 (Fandom › Offspring Seal table; GameFAQs Conquest board 73499249: "Chapter 19 starts them
  at level 2 promoted, each subsequent chapter adds 2"). Fixed at recruitment, not retroactive, and
  unusable once another class-change item is used - so the planner offers it on the join row only
  (`progression.ts › offspringOptions`; stored as `Reclass.seal = 'offspring'`, since a Master Seal can
  reach the same class at Lv 1). It comes with the child, so it costs no seal in automation; a plan
  requiring it and one forbidding it are both solved, and the player is asked when skipping it is
  cheaper (a late seal leaves few level-ups for advanced skills). Research: Luna, 2026-10-02.
- **Items (v3.4, `tools/assets/extract_item_icons.py` → `src/data/itemIcons.json`)** - GameData header
  word 11 (at 0x20) points at the item table; records start 0x10 later, 104 bytes each: +0 IID
  pointer, +16 u16 icon cell, +19 kind (11 seal / class-change item, 12 skill book), +56 seal type
  (0 Master, 1 Heart, 2 Partner, 3 Friendship, 4 Eternal, 5 class change → class id at +57, 6
  Offspring) or the skill a book teaches. Read from the installed build (the Icon Project repoints
  icons). Class items: Dread Scroll (Dread Fighter), Ebon Wing (Dark Falcon), Sighting Lens
  (Ballistician), Witch's Mark (Witch), and unnamed crests for Lodestar / Vanguard / Great Lord /
  Grandmaster (no English MIID_; named after the class). 17 skill books: Paragon, Armor Shield, Beast
  Shield, Winged Shield, Point Blank, Bold Stance, the seven Takers, Heavy Blade, Veteran Intuition,
  Aether, Warp (+57 is 10 / 25 / 35 for the last three, meaning unknown).
- **Skill books in skill access (v3.4)** - when the map that drops the book is toggled on for the run, a
  skill only a book teaches is `available` (`book: true`, picker group "Skill books", notice "From its
  skill book (DLC)"). Book counts per run are only modelled through the per-save item limits.
- **Into a special class from the 20-level tracks (v3.4, `progression.ts › reclassOptions`)** - an own
  special class (Azura's Songstress) is offered by Heart Seal from base (same level) and advanced
  (level + 20), like the DLC classes; before v3.4 Azura could never return to Songstress.
- **Automate progression (v3.4, `autoProgression.ts`)** - targets: equipped skills plus what the unit's
  children plan to inherit from it (minus its own inherited picks and the personal skill). Level-by-
  level search over (class, level, row reclass unused, skills known) mirroring buildProgression,
  entering only classes that teach a target or promote into one; ends at the cap in the selected
  class. Cost, lexicographic (owner priorities, 2026-10-03): seals (an Offspring Seal is free: it
  comes with the child); then level-ups in the selected class; then level-ups in classes
  wielding the focus weapons (an equipped -faire skill's weapon; else the selected class's weapon if
  it has one; else the weapons the player picks, classes wielding all of them before classes wielding
  any); then class growth in Str or Mag, whichever has the higher effective growth in the selected
  class; then in Spd, Def or Res, whichever is highest there. Seal budget grows from a floor (first feasible budget is
  optimal). Pruning, all exact: (1) Pareto dominance per (class, level, row event) - a state that
  knows a superset of skills (bitmask) at a no-worse lexicographic cost dominates, because a
  level-up then learns the same skill or one the other still lacks, and lexicographic order
  survives adding equal future costs; (2) a set-cover lower bound - the targets still missing need
  at least `cover[missing]` more classes, one seal each; (3) a level bound - on the scale base Lv /
  advanced 20 + Lv / special Lv, reclassing never moves back (promotion jumps forward), each
  level-up adds one and the path ends at the goal's cap, so a state learns at most `goalEnd − scale`
  more skills. Eternal Seals: more never need more seals, so 3 Eternal Seals give the floor; the
  plan without searches from that floor, and 1–2 are tried only at the floor (the fewest reaching
  it are offered). Hard Corrin cases (three Lv 15 advanced skills + two Lv 35 DLC skills) solve in
  about 1.3 s on desktop (8 seals, or 5 with two Eternal Seals); before the pruning they took up to
  127 s. Skills no class in reach teaches use their skill book (DLC) or are reported; a skill both
  can teach is asked about (`bookOrClassChoices`), unless another equipped skill without a book
  pins the same class. `npm run audit:skills` replays every roster unit's plan and the hard cases
  through buildProgression.
- **Per-save item limits (research 2026-10-02, curated in `extract_item_icons.py › LIMIT_BY_IID`,
  manifest `limits`; since v3.5 computed per run from the DLC catalog)** - each content DLC map lists
  the items it hands out and how many copies one save gets (`src/data/dlcs.ts`); `itemLimit` adds up
  the enabled maps, and any repeatable map makes its item unlimited. So Hero's Brand (Lodestar) and
  Exalt's Brand (Great Lord) are 1 per save from **Before Awakening's** one-time reward - unless the
  Japan-only Hoshidan / Nohrian Festival of Bonds maps are on, which repeat them (the pre-v3.5
  "Festival of Bonds DLC" switch = both); Paragon's book is 1 (Another Gift From Anna); Anna's Gift
  adds one Sighting Lens or Witch's Mark (the planner conservatively counts one of each). Armor
  Shield, Beast Shield, Winged Shield and Bold Stance books: 0 (item records with no released
  source), so they aren't ways in. Everything else is unlimited: Level 3 Rod/Staff shop stock
  (Master/Heart/Partner/Friendship/Eternal) or repeatable DLC rewards (Dread Scroll, Ebon Wing,
  Sighting Lens, Witch's Mark, Fell Brand, Vanguard Brand, the other books). Automation caps a
  limited item at the limit minus the other units' current plans; the seals pill turns a count over
  the limit red. Names: the four crests are Hero's / Exalt's / Fell / Vanguard
  Brand (no English MIID_ text in the dump). Not modelled (yet): shop stock before Level 3 (after
  Chapter 20: Master Seals 2 then 7, Heart/Partner/Friendship 1 then 3, no Eternal Seals) - Serenes
  Forest › Rod Store / Staff Store.
- **Skill books on the Progression page (v3.4, `skillBooksUsed`)** - when its map is on, an equipped
  skill the path doesn't teach but a book does is assumed learned from the book and counted with the
  seals.
- **Gender-locked class counterparts (v3.4, `classes.ts › sexedClassId`)** - besides the (M)/(F)
  pairs, four pairs have their own names: Monk ↔ Shrine Maiden, Great Master ↔ Priestess, Butler ↔
  Maid, Nohr Prince ↔ Nohr Princess. Fire Emblem Wiki › Reclass: "Male characters that would reclass
  to Shrine Maiden, Priestess, or Maid instead reclass to Monk, Great Master, or Butler,
  respectively; and vice versa for female characters." Before v3.4 the planner gave e.g. Rinkah with
  S Azama Monk / Great Master (194 wrong-gender pool entries across the roster's S pairs); pinned in
  `classes.test.ts`.
- **Exclusive skills (v3.4, `skills.ts › conflictingSkills`)** - the seven stat Takers
  (Strengthtaker … Resistancetaker) each say "Can't use with other Takers." in the game's own
  description (Fire Emblem Wiki › Speedtaker: "Does not overlap with another -taker skill"); the
  planner reads that text from the pack, so Lifetaker (no such line) is unaffected. Two equipped
  Takers get a red notice; pinned in `skills.test.ts`. Serenes Forest › Fates › Skills: "does not
  overlap with other Taker skills" (whether the menu refuses the second one is unconfirmed, so the
  UI says "Can't be used", not "can't be equipped").
  Checked and **not** clashing (research 2026-10-02, owner asked about the Blade pair): Heavy Blade +
  Dancing Blade combine (Serenes › DLC class skills lists "Strength +3, Speed -1" and "Speed +3,
  Defence -1"; GameFAQs board 114533 thread 73519475: "Yes they do"); different Rally skills all fire
  (Fire Emblem Wiki › Rally: "A unit may have multiple Rally skills equipped and all will activate");
  Poison Strike + Grisly Wound + Savage Blow stack (Fire Emblem Wiki › Grisly Wound). Not equip
  clashes but worth knowing: same-stat debuffs on one target don't add, the larger wins (Serenes ›
  Hoshidan class skills: "Debuffs do not stack, but can be combined with other debuffs (when the same
  stat is targeted, the larger effect takes priority)"), so e.g. Strength Seal and Draconic Hex
  overlap on Str; one Rally doesn't stack with itself from two units.
- **Progression** — join class/level from `recruitment.json` (falls back to the primary base class
  at Lv 1). A character's own level cap (GameData +134, `units.json › levelCap`) raises promoted
  segments: Jakob and Felicia join promoted (Butler / Maid) with cap 40 — four built-in Eternal
  Seals; Eternal Seals add 5 on top. (They also gain EXP like unpromoted units; the planner models
  levels, not EXP.) Each level-up adds `(personal + class growth) / 100` to the personal part of every stat;
  the displayed stat is personal + class base, with the personal part clamped so the displayed stat
  never exceeds the current class's cap (overflow is lost, as in-game). Reclasses: base↔base and
  promoted↔promoted keep the level; Master Seal (Lv ≥ 10) promotes to Lv 1 and starts an "Advanced"
  segment; DLC classes are on the 40-level special track (base Lv ≥ 10 keeps its level, promoted
  maps to level + 20); special → base (Lv ≤ 20) / promoted (Lv > 20, level − 20). Eternal Seals add +5 to the
  final promoted/special segment. Later reclasses made illegal by an earlier edit are dropped.
- **Recruitment level** — Paralogue, Xenologue, DLC and "or later" recruits join at a level set by
  when they're recruited, so the plan can override it (`UnitPlan.joinLevel`, clamped to the join
  class's tier). Everyone else uses the recruitment data.
- **Class skills** (sourced: Serenes Forest › Fates › Class Skills, both the Hoshidan and Nohrian
  pages; Fire Emblem Wiki › Reclass › Fates):
  - Recruitment is the only moment several skills arrive together ("Starts with": every skill of
    the join class, and its base classes, at or below the join level).
  - After that, skills come **only on level-up, one per level-up**, "with priority to the earlier
    skill". A skill whose threshold was already passed (after a reclass) arrives on the next level-up;
    reclassing or promoting grants nothing by itself. So reclassing into Samurai at 10 teaches
    Duelist's Blow at 11 and Vantage at 12.
  - Thresholds compare on one scale: base 1/10, advanced 5/15 counted as 25/35 (promoted level =
    20 + level), special 1/10/25/35.
  - An advanced class also offers the skills of every base class **in the unit's pool** that promotes
    into it; those (≤ 10) always outrank its own. Promote at 11 before Vantage and it arrives at
    Advanced 2.
  - Unverified: tie order between two base classes feeding one advanced class (the planner uses
    class-pool order), and whether a pre-promoted recruit holds its base-class skills (assumed yes).
  - **DLC class genders** - Dread Fighter and Dark Falcon are unisex in vanilla Fates (both job variants are in the vanilla table; [Dread Fighter](https://fireemblem.fandom.com/wiki/Dread_Fighter), [Dark Flier](https://fireemblem.fandom.com/wiki/Dark_Flier)). Ballistician, Lodestar, Vanguard and Grandmaster are male-only; Witch and Great Lord are female-only. The installed [Unisex DLC Classes mod](https://gamebanana.com/mods/324622) adds their six opposite-gender jobs at indices 138-143. The per-run mod switch gates those six jobs; each class family still needs its own DLC map toggled on (see the DLC catalog below).
- **Talent** - 17 options, not "any base class" ([Serenes Forest › Avatar Creation › Class
  Options](https://serenesforest.net/fire-emblem-fates/avatar-creation/): Cavalier, Knight, Fighter,
  Mercenary, Outlaw, Samurai, Oni Savage, Lancer (Spear Fighter), Diviner, Monk (male), Priestess
  (female; Shrine Maiden), Sky Knight, Archer, Dragon (Wyvern Rider), Ninja, Mage (Dark Mage),
  Troubadour, Apothecary). [Serenes › Class Sets](https://serenesforest.net/fire-emblem-fates/nohrian-characters/class-sets/):
  "includes every regular class (excludes Songstress, Kitsune, Wolfskin and Villager)".
  Monk/Shrine Maiden is the *only* gendered pair ([Fire Emblem Wiki › Avatar](https://fireemblemwiki.org/wiki/Avatar):
  "the only exceptions are the Monk and Shrine Maiden classes"); Wolfskin/Kitsune are never talents,
  so no gender swap applies to them. Nohr Prince(ss) is Corrin's own class. Fixed 2026-10-08: the
  planner offered Villager and Wolfskin/Kitsune. Pinned in `army.test.ts`.
- **Inherited skill** — chosen from the variable parent's learnable pool (*verify*: Fates passes
  the variable parent's last-equipped skill).
- **Children's bases** use their table offsets from the join point; paralogue scaling by chapter is
  not modelled.

## DLC catalog (v3.5) - `src/data/dlcs.ts`

One entry per purchasable Dragon's Gate DLC; a run enables the ones it can use (`RunPlan.dlcs`,
toggled in the Runs page's **DLC** category). Owner rule (2026-10-08): a DLC is **content** - and gets
a toggle - when it provides a unit, a class or a skill to plan with; experience/gold grinding and
vanity maps get no toggle and no planning effect. Item keys are the installed build's item table
(`data/itemIcons.json`); `null` copies = repeatable reward.

| DLC (NA name) | Grants |
|---|---|
| Before Awakening | Hero's Brand x1 (Lodestar), Exalt's Brand x1 (Great Lord) |
| Royal Royale | Dread Scroll, Ebon Wing (Dread Fighter, Dark Falcon), repeatable |
| Hidden Truths 1 & 2 | Fell Brand (Grandmaster), repeatable |
| Vanguard Dawn | Vanguard Brand (Vanguard), repeatable; Heavy Blade, Veteran Intuition, Aether skill books |
| Anna on the Run | Anna |
| Ballistician Blitz | Sighting Lens (Ballistician), repeatable |
| A Gift from Anna | Sighting Lens or Witch's Mark, one (planner counts one of each) |
| Witches' Trial | Witch's Mark (Witch), repeatable; Warp skill book |
| Another Gift From Anna | Paragon skill book x1 |
| I: In Endless Dreams | Skilltaker, Lucktaker skill books |
| II: Realms Collide | Magictaker skill book |
| III: The Changing Tide | Strengthtaker skill book |
| IV: Light's Sacrifice | Defensetaker skill book |
| V: Endless Dawn | Speedtaker, Resistancetaker skill books |
| End: Lost in the Waves | Point Blank skill book |
| Hoshidan Festival of Bonds (Japan) | Exalt's Brand repeatable |
| Nohrian Festival of Bonds (Japan) | Hero's Brand repeatable |

No toggle (not content): Boo Camp (Experience), Ghostly Gold (Funds), Beach Brawl (illustrations),
Museum Melee (weapons).

Sources (research 2026-10-08): [Serenes Forest › Fates › Downloadable Content (NA)](https://serenesforest.net/fire-emblem-fates/miscellaneous/downloadable-content/)
for the map list and first/repeatable rewards, [› Maps](https://serenesforest.net/fire-emblem-fates/miscellaneous/downloadable-content/maps/)
for per-map detail, [› Japan](https://serenesforest.net/fire-emblem-fates/miscellaneous/downloadable-content/japan/)
for the two festival maps. Quotes: Before Awakening awards "Exalt's Brand, Hero's Brand (first
time), Pebble (unlimited)"; Hidden Truths "Fell Brand, First Blood (unlimited)"; Royal Royale
"Dread Scroll, Ebon Wing (unlimited)" ("Normally these items are gotten from the Link Bonus and are
limited to two per playthrough"); Vanguard Dawn has "enemies holding onto skill scrolls for Steel
Sword, Veteran's Intuition and Aether (all Vanguard skills)"; Witches' Trial has "Witch
reinforcements holding onto ... Warp scroll"; Anna on the Run gives "Anna (first time)"; A Gift from
Anna is "not a map" but a one-time choice of "the Sighting Lens OR the Witch's Mark"; Another Gift
From Anna gives "Boots and Paragon (first time)"; Heirs of Fate I-V and End: Lost in the Waves give
their Taker / Point Blank scrolls; the Japan festivals give "Exalt's Brand" / "Hero's Brand".

Attribution inferences: **Heavy Blade, Veteran Intuition and Aether** are the three Vanguard Dawn
scrolls - the game's item names are 剛剣の書 ("heavy/steel sword book"), 歴戦の勘の書 and 天空の書
(items 363-365, consecutive in the item table), matching Serenes' "Steel Sword, Veteran's Intuition
and Aether". **Warp's** book is item 393, the one Witches' Trial's reinforcements drop.

Not modelled: **First Blood** (Hidden Truths; grants Dragon Vein use, no unit/class/skill), **Boots**
and **Pebble**, the multi-campaign Crystal Ball bonuses (Serenes: "two Dread Scrolls ... when you own
two or more campaigns and two Ebon Wings when you own three"), and **Recollection of Bubbles**
(Japan's Heirs-of-Fate equivalent, "Point Blank scroll and more" - exact rewards unverified; its NA
maps cover the same books). Campaign purchases (Birthright/Conquest/Revelation) are the run's route,
not DLC.

Saved plans: schema 5's `dlc` boolean and `festivalDlc` switch migrate to the id list
(`serialization.ts › migrateRun`): `dlc: true` becomes every NA content map, `festivalDlc: true` adds
both festival maps. New runs start with the NA content maps on (`DEFAULT_DLC_IDS`).

## Verification & open questions
Cross-checks already performed:

- Shiro/Asugi/Selkie/Ryoma/Gunter growths and cap mods match community data exactly.
- Sibling pairs platonic (Ryoma × Hinoka), vanilla marriages romantic (Ryoma × Rinkah).
- Corrin supports fast (`3/7/12/18`); UGF additions (Camilla × Hinoka, Rinkah × Hana) confirmed in
  the mod's `Support Authors and Support Bin Names.txt`.
- Route decoding matches the published route lists for the edge cases (Yukimura, Gunter, Izana,
  Fuga, Anna).
- DLC flags match the eight known DLC class families; Dread Fighter learn levels read 1/10/25/35.
- Ryoma's pair-up support rows read Spd / Str / Skl / Spd+2, matching Serenes Forest exactly.
- All of the above are pinned as Vitest tests (`src/data/dataset.test.ts`).

Open questions (see also docs/REFERENCES.md):

1. **Overstated support edges?** A few S-capable pairs in the UGF export have no conversation file
   in the mod's own list (e.g. Azura × Ryoma, Anna × Ryoma). Resolve by exporting the *installed*
   `work/merge/GameData.bin.lz` with Paragon (or parsing the support table directly) and diffing.
2. **Same-sex children.** UGF grants same-sex S supports; the planner allows any romantic partner
   as a second parent. Verify in-game whether same-sex couples recruit children, and narrow the
   candidate list if not.
3. **A+ partners — resolved (2026-10-01).** Same-sex pairs that can reach S can also reach A+:
   UGF code-patches the support menu to reveal A+ once an S rank has been chosen (owner, from
   in-game play). The planner ignores that ordering and shows every eligible partner as available:
   same-gender, same-generation edges with an open 4th rank, minus the unit's S partner, stored
   one-way.
4. **Child pair-up bonuses — resolved (v3.2).** Children's rows are empty in the table; they take
   the father's C and A rows and the mother's B and S rows (Serenes Forest › Pair-Up Stats: "Any |
   Father's C | Mother's B | Father's A | Mother's S"), except Shigure and male Kana, who take C/A
   from their mother (GameFAQs child pair-up guide). Every other child's fixed parent is the father,
   so the planner uses **fixed parent → C/A, variable parent → B/S** (`supportBonusesOf`), which also
   covers UGF's same-sex couples, for which vanilla defines no rule.
5. **Personal-skill slots.** The three personal-skill fields (+116/118/120) are difficulty variants
   (normal/hard/lunatic) in the table; they are identical for every playable unit on this build, so
   the route-keyed shape in the packs is harmless but semantically loose.
6. **Current support rank.** A plan stores final S/A+ choices, not the active C/B/A support rank.
   v3 pair-up projections use S for spouses and otherwise the pair's highest non-S rank.
7. **Pair-up Mov — resolved (v3.2).** Pair-up blocks are `[Mov, Str, Mag, Skl, Spd, Lck, Def, Res]`,
   not HP-first: the first byte of the class record's `+60` block is 1 for exactly the 14 classes
   Serenes Forest lists with Mov +1 (Paladin, Great Knight, Bow Knight, Outlaw, Adventurer, Wyvern
   Lord, Malig Knight, Dark Knight, Strategist, Falcon Knight, Kinshi Knight, Ninja, Master Ninja,
   Dark Falcon) and 0 elsewhere; personal support rows share the layout with that slot always 0. The
   pack keeps the raw order; `lenses.ts › pairUpRow` maps it to a table row (HP blank, Mov last).
8. **Route-locked Nobles (v3.2).** Hoshido Noble is unavailable on Conquest and Nohr Noble on
   Birthright, for everyone including children and seal partners (Fire Emblem Fandom › Nohr Prince:
   "Nohr Noble (Conquest/Revelation)", "Hoshido Noble (Birthright/Revelation)"); `army.ts ›
   classOnRoute` filters every class pool.
9. **Jakob/Felicia (v3.2).** The retainer of the *opposite* gender to Corrin joins in Chapter 6; the
   other joins after Chapter 15 at Lv 13 (Serenes Forest recruitment tables). The curated source
   carries `lateIfCorrin`; `recruitment.json` emits an `ifCorrin` override that `recruitmentOf`
   applies for the run's Corrin.
10. **Corrin's A-rank seals (v3.2, confirmed).** Corrin *does* take a partner's secondary class when
    the primary can't be sealed: Kaden/Selkie → Diviner, Keaton/Velouria → Fighter (Serenes Forest ›
    Class Changing: "the character will borrow their partner's second class set instead").

## Pack format (v1)

- `characters.json` — `[{ id, name, supportRoute?, isCorrin? }]` (support-pack order = edge indexes)
- `supports.json` — `{ edges: [[a, b, rawType]] }`
- `units.json` — `{ meta, units: [{ id, name, fid, slot, gender, supportRoute, routes, dlc, baseStats, growths, capMods, classes, reclasses, personalSkills, supportBonuses, attackBonuses, fixedParent, isCorrin }] }`
- `classes.json` — `{ meta, classes: [{ id, name, ja, jid, tier, dlc, baseStats, growths, caps, pairUp, skills, skillLearn, promotesTo, promotesFrom, movement }] }`
- `skills.json` — `{ meta, skills: [{ id, name, description, icon, dlc }] }`
- `meta.json` — pack provenance for the support graph (the game-data packs carry their own `meta`)

The loader (`src/data/loader.ts`) resolves ids, decodes types, and builds lookup maps; all files
are lazy `import()`s so they arrive as separate chunks. The asset manifest
(`src/data/assets.json`) is generated by `tools/assets/extract_assets.py`; see docs/ASSETS.md.
