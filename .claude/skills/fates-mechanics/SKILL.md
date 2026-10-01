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

- Duplicate branches fall back to the contributor's next (secondary) branch. Seals can't grant Nohr
  Prince(ss)/Wolfskin/Kitsune/Villager → secondary instead — **this applies to Corrin's A ranks too**:
  Kaden/Selkie → Diviner, Keaton/Velouria → Fighter (Serenes › Class Changing: "the character will
  borrow their partner's second class set instead"). Pinned in `corrinPlanning.test.ts`.
- Songstress is never inherited, but stays in **Azura's own** set (bug fixed v3.1).
- Corrin's talent: joins Corrin's pool; **Kana** (Corrin = fixed parent) inherits the talent; a child
  with Corrin as **variable** parent (e.g. Shigure) gets the Nohr Prince tree, never the talent
  (Fire Emblem Wiki › Shigure). Seal partners of Corrin get the talent.
- **Route-locked Nobles**: Hoshido Noble unavailable on Conquest, Nohr Noble on Birthright, for
  everyone (children, seals included) — `army.ts › classOnRoute` filters every pool and promotions.

## Supports — `relationships.ts`, `selectors.ts › candidatesFor`

- **A+ is one-way** ("unlike other supports, they are not mutual" — Fire Emblem Wiki › Support).
  S and pair-up are mutual and exclusive.
- **A+ ranks are only shared within a generation** (owner ruling, 2026-10-01): first-gen with
  first-gen, children with children. `army.ts › sameGeneration` filters the A+ picker
  (`candidatesFor`) and `unitContext` ignores a stale cross-generation `aPlusPartner` (no class
  granted). Does not apply to Corrin's A-rank Friendship Seal set (that isn't A+). Pinned in
  `corrinPlanning.test.ts`.
- **Corrin cannot give or take A+.** Corrin can Friendship Seal with **any same-gender A-rank
  partner**; the plan stores the ones the player intends to reach (`UnitPlan.friendshipPartners`,
  toggled via `toggleFriendshipPartner`; UI: Corrin's "A Rank" multi-select). Corrin's S partner is
  excluded from that set (setting S drops them from it).
- Only Corrin can marry into the second generation, so only Kana can have a child as Parent B.

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
