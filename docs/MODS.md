# Mods

What the installed game build changes, and what that means for the planner. Source of truth is
the companion workspace `../3ds-games/fe-fates/` (`inbox/mod-list.md`, `tools/mod-manifest.json`,
`AGENTS.md`). Build date: 2026-09-28, USA Special Edition (`0004000000179800`, `CTR-P-BFZE`).

## Installed mods

| Mod | Version | Gameplay? | What it changes | Planner effect |
|---|---|---|---|---|
| **Unofficial Gay Fates (UGF)** | 2.5.2 | ✅ | Expands the support graph to near-universal coverage: same-sex S supports, huge new conversation sets, Corrin/child/sibling additions, adjusted support routes | Drives the whole support dataset; never apply vanilla pairing limits |
| **Free Renown Rewards** | 1.0 | ✅ | All 160 minimum BP/VP requirements zeroed | Renown rewards are effectively free; no grind budget needed |
| **Free battle and visitation rewards** | 1.0 | ✅ | Same GameData edit (verified identical) | Battle/visit rewards free |
| **Tru's Accessory Shop** | v2 | ✅ | Full accessory catalog added to the shop (models via Texture Compilation ROM6) | All accessories obtainable in one shop |
| **Tru's Free Accessory Prices** | addon | ✅ | `AcceShop.bin.lz` replaced: prices set to free | Accessory spending ≈ 0 gold |
| Unit Select Voice | 1.3.4 | ❌ (audio) | Per-unit voice selection; adds missing Corrin voice strings | Voice picker someday; no planning math |
| Fates Icon Project (regular) | 1.0 | ❌ | Menu/skill/item icons | None |
| Texture Compilation | 6.7 | ❌ | Class/outfit textures (+ Gold faceless fix) | None |
| Furry Fates | 2.2 | ❌ | Model/texture swaps | None |
| Dragon-Hare Corrin | 5.0 | ❌ | Corrin model (Male+Female variant) | None |

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
2. Update `src/data/modProfiles.ts`: mod list, versions, feature flags, notes.
3. If UGF changed: rerun `python tools/extract/extract_ugf_supports.py` and update
   docs/DATA.md verification notes.
4. If a new gameplay mod landed: decide its planner effect (flag or data delta) and record it here.
