# Mods

What the installed game build changes, and what that means for the planner. Source of truth is
the companion workspace `../3ds-games/fe-fates/` (`inbox/mod-list.md`, `tools/mod-manifest.json`,
`AGENTS.md`). Build date: 2026-10-04, USA Special Edition (`0004000000179800`, `CTR-P-BFZE`).

## Per-run Mods checklist

Only switches that change the planner's support or class data, or have alternate art the planner can
show, belong in the checklist. The installed build has four such switches:

| Category | Mod | Version | Planner effect |
|---|---|---|---|
| Game data | **Unofficial Gay Fates (UGF)** | 2.5.2 | Expands the support graph to near-universal coverage. Required until a vanilla support pack exists. |
| Game data | **Unisex DLC Classes** | 2024-07-24 | With DLC enabled, opens female Ballistician, Lodestar, Vanguard and Grandmaster, and male Witch and Great Lord (installed build jobs 138-143). Dread Fighter and Dark Falcon are available to both genders even without this mod. |
| Vanity | **Furry Fates** | 2.2 | Shows alternate talk portraits for Kaden, Keaton, Selkie and Velouria, plus Kaden/Keaton map sprite variants. |
| Vanity | **Dragon-Hare Corrin** | 5.0 | Shows alternate talk portraits for male and female Corrin. |

The following installed mods stay out of the per-run checklist because none changes a value the
planner calculates or displays as game data:

| Mod | Version | Installed effect |
|---|---|---|
| Free Renown Rewards and Free battle and visitation rewards | 1.0 | Zero BP/VP reward thresholds; the planner does not schedule reward grinding. |
| Tru's Accessory Shop and Tru's Free Accessory Prices | v2 / addon | Full accessory catalog in the shop and zero prices; the planner does not track accessories or gold. |
| Unit Select Voice | 1.3.4 | Per-unit voice selection and Corrin voice strings. |
| Fates Icon Project (regular) | 1.0 | Installed item icons are used as the app's fixed icon set. They do not vary by run. |
| Texture Compilation | 6.7 | Model and outfit textures, including the Gold Faceless fix; no corresponding planner art view. |

### Not installed (deliberately)

- **Body Accessories Always Visible** — conflicts with Texture Compilation's class outfits
  (~116 ROM2/ROM3 spec collisions). Tru's Shop was chosen instead.
- **Corrinsexual Rebalance** (UGF optional file) — *not installed*, so base stats/growths for
  Corrinsexuals remain vanilla. If it is ever added, stats must be re-extracted.

## What UGF actually changes (observed in its Paragon export)

- The support table for the ~71 support-bearing playable characters is **near-complete**: 2,463
  unique pairs. Almost every pair has a support; whether it can marry is per-pair.
- Support types decode from the raw u32 as four byte thresholds, high byte first
  (`S<<24 | A<<16 | B<<8 | C`); sibling/platonic pairs store `0xFF` for S:

  | Raw | Meaning | Thresholds C/B/A/S |
  |---|---|---|
  | `0x140E0904` | Romantic | 4 / 9 / 14 / 20 |
  | `0xFF0E0904` | Platonic (A max) | 4 / 9 / 14 / — |
  | `0x120C0703` | Fast romantic | 3 / 7 / 12 / 18 |
  | `0xFF0C0703` | Fast platonic | 3 / 7 / 12 / — |

- Corrin's supports are fast (`3/7/12/18`), as are sibling-style pairings; vanilla marriages such
  as Ryoma×Rinkah or Xander×Charlotte stay romantic at normal speed.
- `Modules.Characters` contains raw `Support Route` values (5/6/7 observed) — semantics still
  undecoded; route availability per pair is an open data question (docs/DATA.md).
- **Same-sex children caveat**: UGF grants same-sex S supports; the planner lets any romantic
  partner be a second parent. Whether UGF couples actually recruit children in-game should be
  spot-checked once; if they don't, the candidate list needs narrowing (docs/DATA.md).

## Maintenance when the build changes

1. Read `inbox/mod-list.md` / `tools/mod-manifest.json` in the fe-fates workspace.
2. Update `src/data/modProfiles.ts`: the per-run data and vanity switches, versions, feature flags, notes.
3. If UGF changed: rerun `python tools/extract/extract_ugf_supports.py` and update
   docs/DATA.md verification notes.
4. If a new gameplay mod landed: decide its planner effect (flag or data delta) and record it here.
