# Data pipeline

Everything the planner knows comes from **the exact build being played** — the modded workspace at
`../3ds-games/fe-fates/` plus the game's own tables. This document records what is extracted, how,
and what is still open.

## What's in the packs

| Data | State |
|---|---|
| Support graph (UGF: who supports whom, marriage vs platonic, speed, thresholds) | ✅ `supports.json` |
| Units (71 playables: English names, bases, growths, cap mods, class sets, personal skills, route availability, DLC flag, fid) | ✅ `units.json` |
| Classes (129: growths, caps, pair-up, class skills, learn levels, promotions, movement, DLC flag, jid) | ✅ `classes.json` |
| Skills (229: names, in-game descriptions, icon index, DLC-only flag) | ✅ `skills.json` |
| Child rules (fixed parents, growth averaging, cap-mod combination, class inheritance) | ✅ in `src/logic/` |
| Pair-up bonuses (class bonuses + per-unit C/B/A/S support bonuses) | ✅ in the packs (rule sourced below) |
| A+ (friendship) exact partner tables | ⚠️ approximated (platonic edges that reach A; one-way choice) |
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
| Classes | `0xEA10` | 129 × 128 | jid (+8), name ptr (+16), bases (+28), growths (+36), caps (+52), pair-up (+60), weapon ranks (+68), class skills (+84…90), movement (+93), promotions (+100/+102), base classes (+104/+106), DLC index (+123) |
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
  - first gen: own primary branch + secondary branch
  - second gen: own branch + fixed parent's primary branch + variable parent's primary branch
  - everyone: Partner Seal (S) and Friendship Seal (A+) branches
  - duplicates fall back to the contributor's next branch; Songstress never inherits (it stays in
    Azura's own set); Nohr
    Prince(ss)/Wolfskin/Kitsune/Villager can only come from parents (not seals)
  - Corrin's chosen talent joins Corrin's pool; any child whose parent is Corrin inherits the
    talent's branch in place of Corrin's (Nohr Prince(ss)) primary
  - Corrin's Friendship Seal is not limited to a chosen A+ partner: every same-gender unit Corrin
    can reach A with contributes a branch
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

- **Roster** — units on the run's route (plus DLC Anna when DLC is on), only the Corrin matching the
  chosen gender and that Corrin's Kana. Children are always listed.
- **Relationships** — S and pair-up are exclusive and mutual. A+ is a one-way choice: picking
  Jakob as Ryoma's A+ does not set Jakob's, and several units may pick the same partner. A child's second parent is never
  stored: it *is* the fixed parent's S partner, so the roster/profile "Parent B" slot writes
  through to that S bond. Switching Corrin's gender moves Corrin's and Kana's plans (and every
  reference, favourite and gendered class id) onto the other variant.
- **Candidates** — S / Parent B: romantic edges of the subject in the build's graph. A+: platonic
  edges that reach A. Pair-up: anyone on the roster (rank only changes the bonus).
- **Pair-up rank** — S between spouses, otherwise the highest non-S rank the edge allows (A+ pairs
  fight at A); no edge → class bonus only.
- **Lenses** — "Stat Modifiers" = personal cap mods (+ boon/bane, child rule); pair-up lenses and
  modifiers have no HP value (rendered `-`, unsortable).
- **Progression** — join class/level from `recruitment.json` (falls back to the primary base class
  at Lv 1). Each level-up adds `(personal + class growth) / 100` to the personal part of every stat;
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
- **DLC gender locks (vanilla)** — Dread Fighter, Ballistician, Lodestar, Vanguard, Grandmaster:
  male; Dark Falcon, Witch, Great Lord: female. The class table carries both variants for some.
- **Talent** — any base class except Nohr Prince(ss); Monk/Wolfskin male-only, Shrine
  Maiden/Kitsune female-only (vanilla avatar rules).
- **Inherited skill** — chosen from the variable parent's learnable pool (*verify*: Fates passes
  the variable parent's last-equipped skill).
- **Children's bases** use their table offsets from the join point; paralogue scaling by chapter is
  not modelled.

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
3. **A+ partners.** Exact per-character A+ lists are not in the extracted data, and UGF's A+
   behaviour is not documented beyond its support graph; v3.1 offers platonic edges that reach
   rank A and stores the choice one-way (Friendship Seal semantics).
4. **Child pair-up bonuses.** Children have empty support-bonus rows in the table; the documented
   inheritance rule (father C / mother B / father A / mother S) still needs a mechanics decision.
5. **Personal-skill slots.** The three personal-skill fields (+116/118/120) are difficulty variants
   (normal/hard/lunatic) in the table; they are identical for every playable unit on this build, so
   the route-keyed shape in the packs is harmless but semantically loose.
6. **Current support rank.** A plan stores final S/A+ choices, not the active C/B/A support rank.
   v3 pair-up projections use S for spouses and otherwise the pair's highest non-S rank.
7. **Pair-up Mov.** Some classes grant Mov when paired, but `pairUp` is the eight stats at class
   record `+60` and `+68` starts the weapon ranks; the Mov bonus byte is not located yet. Pair-up
   lenses render Mov as `-` until it is decoded.

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
