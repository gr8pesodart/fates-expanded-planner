---
name: fates-mechanics
description: Verified Fire Emblem Fates game rules the planner implements — class skill learning, recruitment levels, skill and class inheritance, A+/Friendship Seal and Corrin's special cases, route-locked classes, pair-up bonuses (incl. the Mov byte and children's rows), recruit order and stat colouring — each with its source, the code that implements it, and the test that pins it. Use before changing anything in src/logic/ (progression, classes, skills, army, lenses, parents, relationships) or answering a mechanics question, so settled rules aren't re-litigated or "fixed" back into bugs.
---

# Fates mechanics — what's verified and where it lives

Canonical write-ups: `docs/DATA.md` (rules + "Open questions", several now resolved). Engine rules are
vanilla Fates; the installed mod (Unofficial Gay Fates 2.5.2) only changes the support graph (its
code patch adds a paralogue unlocker, custom endings, "S ranks convert to A after marriage").
Reliable sources: Serenes Forest Fates pages, Fire Emblem Wiki (`?action=raw` avoids truncation),
Fandom; GameFAQs/Reddit only as corroboration. Always quote + cite in DATA.md and pin in a test.

## Class skills — `src/logic/progression.ts` (tests: `progression.test.ts`)

- Skills are learned **only on level-up, one per level-up**, "with priority to the earlier skill";
  a skill whose threshold was already passed (after a reclass) arrives on the **next** level-up.
  Reclassing/promoting grants nothing itself. (Serenes Forest › Fates › Class Skills.)
- One threshold scale: base 1/10, advanced 5/15 counted as 25/35 (promoted level = 20 + level),
  special 1/10/25/35.
- An advanced class also offers the skills of every **base class in the unit's pool** that promotes
  into it (Fire Emblem Wiki › Reclass). Example: Samurai @10 → Duelist's Blow @11, Vantage @12;
  promote @11 → Vantage at Advanced 2.
- **Recruitment is the only time several skills arrive** ("Starts with", shown above the level list).
- Unverified: tie order between two base classes feeding one advanced class (pool order used);
  pre-promoted recruits assumed to hold their base skills.

## Level caps — `progression.ts › tierCap` (test: progression.test.ts › Jakob and Felicia)

- Base 20, promoted 20, special 40, +5 per Eternal Seal. A unit's own `levelCap` (GameData +134)
  replaces the promoted cap: **Jakob and Felicia = 40** (owner, 2026-10-01: promoted Butler/Maid
  that gain EXP like unpromoted units — effectively four built-in Eternal Seals).

## Recruitment — `army.ts › classStart`, `recruitmentOf`; data `recruitment.json`

- Paralogue / Xenologue / DLC / "or later" recruits have a plan-editable join level
  (`UnitPlan.joinLevel`). Fixed recruits use the data.
- **Jakob/Felicia**: the retainer of the *opposite* gender to Corrin joins Ch. 6; the other joins
  after Ch. 15 at Lv 13 (Serenes recruitment tables). Encoded via `lateIfCorrin` in the curated
  source → `ifCorrin` override in the pack → `recruitmentOf(dataset, run, id)`. Always read
  recruitment through `recruitmentOf`, never `dataset.recruitment` directly.
- Recruit order shown everywhere (Roster, pickers, Parents) = **all first-gen units, then children**,
  each in recruit order (`selectors.ts › compareRecruitOrder`). Raw recruitment order would slot
  paralogue children right after Chapter 7.

## Skill inheritance — `skills.ts › inheritableSkillPool` (tests: `skills.test.ts`)

- A child inherits **one skill from each parent** (the lowest eligible equipped skill). Plan fields:
  `inheritFixedSkill` and `inheritSkill` (= Parent B). (Fire Emblem Wiki › Inheritance, › Kana.)
- Never inherited: personal skills, DLC skills, Songstress skills. Same skill from both parents is
  blocked in the picker (game behaviour unverified).

## Class inheritance and seals — `classes.ts › classPool`, `army.ts`

- **Unisex DLC Classes (2026-10-04)**: Dread Fighter and Dark Falcon are already usable by both genders in vanilla Fates. The installed mod adds female Ballistician, Lodestar, Vanguard and Grandmaster, plus male Witch and Great Lord (jobs 138-143). The per-run `unisex-dlc-classes` switch gates only those six; each class family also needs its own DLC map toggled on (`RunPlan.dlcs`; catalog `data/dlcs.ts`, owner 2026-10-08: one toggle per content map - Anna's map for the unit, Before Awakening for the two brands, the class maps for their class items and books). `dlcClassesFor(dataset, gender, run)` filters on both and drives pickers, progression, automation, and skill access. The appended job records come from `work/merge/GameData.bin.lz`; tests in `progression.test.ts` and `dataset.test.ts` pin the behavior.
- **Gendered class names (v3.4, `sexedClassId`)**: Monk ↔ Shrine Maiden, Great Master ↔ Priestess,
  Butler ↔ Maid, Nohr Prince ↔ Nohr Princess swap by gender like the (M)/(F) pairs (Fire Emblem Wiki ›
  Reclass). Before v3.4 women with S Azama got Monk. Pinned in `classes.test.ts`.
- **Class inheritance and seal sharing (2026-10-05, `classes.ts › classPool`)**: inheritance walks
  Class A → B → alternate A → alternate B for each parent, father before mother, skipping classes
  the child already has and Songstress. Seal sharing instead follows donor A → B → alternate A;
  unique Class A slots advance to B and only the recipient's own Class A causes another advance.
  Corrin and Kana use the donor's alternate B as the seal chain's last slot. Alternate classes come from the
  Fates class-pair table in the [GameFAQs inheritance guide](https://gamefaqs.gamespot.com/3ds/114533-fire-emblem-fates-conquest/faqs/72752).
  Evidence examples: “Jakob gets Cavalier from Silas”; for Jakob!Shigure, “Wyvern Rider, inherited
  from Azura”; Nyx gives Nina “her tertiary class, Diviner” ([Nina](https://fireemblem.fandom.com/wiki/Nina)).
  `classes.test.ts` pins all three cases plus alternate-A seal sharing. Fixed-parent order remains a
  deterministic fallback for UGF same-sex parent pairs, whose vanilla inheritance order is undefined.
- **Own class-set decoding (2026-10-05)**: `units.json › classes[1]` can be a promoted companion, not
  another base-class branch. Promotions with multiple `promotesFrom` entries make `baseOfClass`'s
  first entry unsafe for identifying a unit's own class B: Laslow's Hero record would falsely add
  Fighter, and Selena's Bow Knight record would falsely add Outlaw. Serenes Forest's class-set table
  lists Laslow as Mercenary/Ninja and Selena as Mercenary/Sky Knight. `ownBaseClasses` uses the
  primary class line and `reclasses`; `classes.test.ts` pins the false branches away.
- **Special classes from base/advanced (v3.4)**: Heart Seal into an own special class (Azura's
  Songstress) keeps the level from base, +20 from advanced (`reclassOptions`). Pinned in
  `progression.test.ts`.
- **Automate progression (v3.4, `autoProgression.ts`, tests + `tools/audit/autoProgression.audit.ts`)**:
  see DATA.md; it must stay in step with buildProgression's learning rules (verifyAutoPlan replays).
- **Children's chapter + Offspring Seal (v3.4, `childRecruit.ts`, tests in `progression.test.ts` and
  `autoProgression.test.ts`)**: children join by recruitment chapter (never before the later parent);
  level table and Offspring Seal rules (Chapter 19+: advanced Lv 2 per chapter past 18, join row
  only, free in automation) are in DATA.md. Read `ctx.start.child`, never `joinLevel`, for children.
- **Automation priorities (owner, 2026-10-03)**: seals (Offspring Seal free), then levels in the
  selected class, then focus-weapon levels (faire weapon, else
  the selected class's single weapon, else player-picked weapons: all before any), then Str-or-Mag
  growth, then Spd/Def/Res growth (stats chosen by effective growth in the selected class). Limited
  items (Hero's / Exalt's Brand, Paragon book) are capped run-wide; dominance compares their use too.
- **Items / skill books (v3.4)**: item table layout and the 17 books in DATA.md › Items; books make
  their skill `available` while the map that drops them is toggled on (per-run `RunPlan.dlcs`,
  catalog `data/dlcs.ts`); per-save counts come from `itemLimit(key, run)` over the same grants.
- Seals can't grant Nohr Prince(ss)/Wolfskin/Kitsune/Villager as donor Class A → advance to Class B.
  This applies to Corrin's A ranks too: Kaden/Selkie → Diviner, Keaton/Velouria → Fighter. Do not
  advance just because the recipient already has the donor's class somewhere in their pool: Jakob's
  A+ with Silas resolves to Cavalier (already Jakob's Class B), never Mercenary.
- Songstress is never inherited, but stays in **Azura's own** set (bug fixed v3.1).
- Corrin's talent is class B: Kana skips the matching Nohr Prince(ss) class A and inherits the talent;
  a child with Corrin as **variable** parent (e.g. Shigure) inherits Nohr Prince(ss) as class A.
  Seal sharing with Corrin likewise starts at the first eligible class slot.
- **Talent options (2026-10-08, `army.ts › talentOptions`, test `army.test.ts`)**: exactly **17**, not
  "any base class". Serenes Forest › Avatar Creation › Class Options lists them - Cavalier, Knight,
  Fighter, Mercenary, Outlaw, Samurai, Oni Savage, Lancer (Spear Fighter), Diviner, Monk (male),
  Priestess (female; Shrine Maiden), Sky Knight, Archer, Dragon (Wyvern Rider), Ninja, Mage (Dark
  Mage), Troubadour, Apothecary - and Serenes › Class Sets notes it "excludes Songstress, Kitsune,
  Wolfskin and Villager". Monk/Shrine Maiden is the **only** gendered pair (Fire Emblem Wiki ›
  Avatar: "the only exceptions are the Monk and Shrine Maiden classes"); Wolfskin/Kitsune are never
  talents at all, so the old Monk/Wolfskin male, Shrine Maiden/Kitsune female mapping was wrong.
  Nohr Prince(ss) is Corrin's own class. The game's *labels* differ from class names (Lancer,
  Dragon, Mage, Priestess). Bug fixed 2026-10-08: Villager and Wolfskin/Kitsune were offered.
- **Route-locked Nobles**: Hoshido Noble unavailable on Conquest, Nohr Noble on Birthright, for
  everyone (children, seals included) — `army.ts › classOnRoute` filters every pool and promotions.

## Supports — `relationships.ts`, `selectors.ts › candidatesFor`

- **A+ is one-way** ("unlike other supports, they are not mutual" — Fire Emblem Wiki › Support).
  S and pair-up are mutual and exclusive.
- **A+ eligibility is `army.ts › aPlusEligible`** — used by both the picker (`candidatesFor`) and
  `unitContext` (a stale pick that fails it grants no class). Rules: **same gender** and an edge
  whose **4th rank is open** — the game stores one 4th-rank threshold per pair and reads it as A+
  for same-gender pairs, S otherwise; `0xFF` (siblings, characters UGF caps at A) stops at A.
  **Do not use "platonic" (S locked) edges for A+** — that was the pre-2026-10-01 bug: in UGF
  almost every same-generation pair is S-capable and almost every S-locked edge is cross-generation,
  so combined with the generation rule it left children with no A+ options at all.
  Owner rulings on top (2026-10-01): **same generation only** (first-gen with first-gen, children
  with children), and **never the unit's S partner**. Same-sex S-capable pairs genuinely reach A+
  in UGF (owner, 2026-10-01: a UGF code patch reveals A+ once an S rank has been chosen); the
  planner deliberately ignores that ordering and lists every eligible partner as available. Does not apply to Corrin's A-rank Friendship
  Seal set (that isn't A+). Pinned in `corrinPlanning.test.ts`.
- **Corrin cannot give or take A+.** Corrin can Friendship Seal with **any same-gender A-rank
  partner**; the plan stores the ones the player intends to reach (`UnitPlan.friendshipPartners`,
  toggled via `toggleFriendshipPartner`; UI: Corrin's "A Rank" multi-select). Corrin's S partner is
  excluded from that set (setting S drops them from it).
- Only Corrin can marry into the second generation, so only Kana can have a child as Parent B.
- **Per-gender Corrin (v3.3, `corrin.ts`, tests `corrin.test.ts`)** — owner ruling: each gender keeps
  its own boon/bane/talent (`run.corrin.builds`), relationships, classes, progression and skills;
  name, hair colour and the favourite star are shared. `switchCorrinGender` releases the leaving
  pair's partners and restores the arriving pair's bonds if the partner is free; otherwise the
  one-sided link is "stale" — **read bonds through `relationships.ts › bondPartner`** (mutual only),
  never `plan.sPartner` directly, or a stale link will grant classes/parents.

## Skill access — `skillAccess.ts` (tests: `skillAccess.test.ts`)

- **Exclusive skills (v3.4, `skills.ts › conflictingSkills`)**: the seven stat Takers carry "Can't use
  with other Takers." in their game description; the planner keys off that text (Lifetaker lacks it).
  Researched 2026-10-02: no other equip clash exists; **Heavy Blade + Dancing Blade combine** (don't
  "fix" them into a clash). Sources and the debuff-overlap note are in DATA.md › Exclusive skills.
- Groups, in picker order (UI: In progression / Not in progression / Inheritable only / Requires
  support / Not accessible): progression (learned on the planned path / chosen inherited) → available
  (current pool + DLC classes) → inheritable (a current parent's inheritable pool, and - v3.4 owner
  ruling - skills **only** another possible second parent could pass on; a parent's class is read in
  the child's gender unless that version doesn't teach the skill) → locked (each
  roster S partner / A+ partner / Corrin A-rank partner / other second parent tried one at a time on
  top of the current plan, plus those parents' inheritable pools). Never lists the unit's personal
  skill; skills nothing in the run gives are omitted. Each candidate relationship resolves its own
  class-sharing slot; a second relationship does not make either slot fall through. **Run
  `npm run audit:skills` after touching `classPool` or `skillAccess`** — it brute-forces every
  relationship combination and must find 0 gaps. Results are cached per run object + filters (plans
  are immutable). `unavailable` covers the rest
  (owner: no reasons; DLC classes left out while their map's toggle is off). `classes` (per-class status + ways) drives the picker's Grouped view so a skill shows
  under every class teaching it (owner: Locktouch under Outlaw and Ninja). `SkillFilters` (picker
  toggles, per unit) drop new S or A+ candidates (`s`, `a`) or, once a child's second parent is
  chosen, the other possible second parents (`p`) from the analysis.

## Hair colour — `hair.ts › hairColourOf` (tests: `hair.test.ts`)

- Children take the **variable parent's** hair colour (Fire Emblem Wiki › Inheritance: "their
  mother's hair colour, with the exception of a male Kana (who inherits the hair color of his
  father)" — both are the variable parent). Shigure's hair is fixed (Azura's). Corrin = chosen swatch.

## Expected Final Stats — `progression.ts › expectedFinal`

- Last row of `buildProgression` (no reclasses → join class to Lv 20 / 40) + final class Mov;
  `base: true` when the path never leaves a base class (Roster mutes that row). `routeSteps` gives
  the Chart's compact path: join class, then each applied reclass at its level.

## Pair-up — `lenses.ts › pairUpRow`, `army.ts › supportBonusesOf` (tests: `lenses.test.ts`)

- Pair-up blocks (class `pairUp` at class record `+60`, personal support rows) are
  **[Mov, Str, Mag, Skl, Spd, Lck, Def, Res]** — not HP-first. Byte 0 is 1 for exactly the 14 classes
  Serenes lists with Mov +1 (Paladin, Great Knight, Bow Knight, Outlaw, Adventurer, Wyvern Lord, Malig
  Knight, Dark Knight, Strategist, Falcon Knight, Kinshi Knight, Ninja, Master Ninja, Dark Falcon).
  The pack keeps raw order; always map through `pairUpRow` (HP blank, Mov last).
- Children's personal rows are empty in data: **fixed parent → C and A rows, variable parent → B and
  S rows** (Serenes: father's C/A, mother's B/S; Shigure and male Kana take C/A from their fixed
  mother — so "fixed/variable" covers everyone, incl. UGF same-sex couples). Recursive when Kana's
  other parent is a child.
- Stat table Mov column: class movement in Max Stats / Base Stats; pair-up value in pair-up lenses;
  `-` for growths and modifiers.

## Stat colouring — `lenses.ts › colourReferenceClassIds`

- Class lenses: compared with **every playable class of the same tier**; effective lenses: the unit's
  own classes of that tier; personal lenses: the army. **DLC classes count as advanced** for this
  (they're `special` in data; grouping them alone skewed colours — the Effie/Maid report).
- Colour is applied to text (`--stat-low/mid/high`), not cell fill.

## Parents tab maths — `src/logic/parents.ts` (tests: `parents.test.ts`)

- Default view = the parent's own contribution: their stat modifiers, personal growths, and their
  B + S pair-up rows; a sort-sheet toggle shows the child's resulting values instead.
