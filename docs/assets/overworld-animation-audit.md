# Overworld (map) sprite animation audit

Scope: the official FE Fates **map/overworld unit sprites** the planner already ships as static
idle images — `unit/Body/<class>/`, `unit/Head/<unit>/`, `unit/Unique/<class>_<unit>/` in the
owner's romfs dump. Question: do they animate, what is in the data, and how hard is a
browser-friendly animated extraction? Findings below are from the dump and the local toolchain;
no other planner's assets or code were used.

**Verdict.** Yes. Every class ships a 9-clip animation script (`anime.bin`): an idle loop plus
**8 facing directions** × 4 frames (4 cardinals + 4 diagonals). All art needed for browser
animation is already decodable by the existing pipeline; the cheapest shape is animated body
strips per class + head strips per unit composited client-side, exactly like today's idle sprite
layering. The 4 diagonals are the reason 8 movement clips exist; the file stores no clip names,
so that reading is inferred from the art (evidence in "Facings" below).

## Sources and tooling (what exists here)

| Thing | Status |
|---|---|
| Owner's dump | Present at `D:\Local Work\Dev Projects\3ds-games\fe-fates\work\cia-extract\romfs\unit\{Body,Head,Unique,Shadow}` (the repo's `../3ds-games` sibling lives next to the **main** checkout, not next to this worktree — `extract_sprites.py`'s defaults do not resolve from here; pass `--romfs`/`--fe-tools`) |
| Decoders | `tools/assets/fe_assets.py` (BCH + pixels) + sibling `fe_tools/lz13.py`; Pillow 12.3.0 |
| Existing extractor | `tools/assets/extract_sprites.py` parses all clips already (`parse_animations`) but exports only `animation[0].frames[0]` |
| Format notes | `docs/assets/anime-bin.md` (record layout, draw order); byte layout re-verified for this audit |
| Missing | No game code / symbol dump, and no clip-name table anywhere in the files (or in Paragon's local source, `tools/_dl/paragon-src` — it reads the same records but names nothing). `tools/extract/sources/` is empty (not needed). No attack/staff overlay textures exist next to the sheets |

## Inventory on disk

| Path | Contents |
|---|---|
| `unit/Body/<class>/` × 116 | `青0 青1 赤0 赤1 緑0 緑1 紫0 紫1 .bch.lz` (928 files) + `anime.bin` (4696 B) |
| `unit/Head/<unit>/` × 259 | same 8 faction sheets, no script |
| `unit/Unique/<class>_<unit>/` × 34 | same 8 sheets + `anime.bin` |
| `unit/Shadow/Shadow.bch.lz` | one 32×32 binary-alpha mask shared by all units (ink bbox 1,8–9,24) |
| Faction colors | 青 player / 赤 enemy / 緑 ally / 紫 other. All 116 body folders carry all four; same geometry, palette only. The planner needs 青 only |

`anime.bin` = BinArchive (0x20 header) + global header (uses_staff, count) + 12×388-byte records;
`Dark Pegasus M/F` ship 11 records, everything else 12. Record fields are unchanged from
`docs/assets/anime-bin.md`; this audit only adds how the records map onto the sheets.

## The animation model (verified across all 150 scripts)

- **9 clips used (0–8) in all 116 Body + 34 Unique scripts.** Records 9–11 are zero everywhere
  except Golem's Unique slot 9 (see Exceptions).
- **36 distinct frames per class**: global `frame_index` is 0…35 in every file.
  * `青0` (rotated 128×32) = idle strip, 4 body cells.
  * `青1` (rotated 128×512) = 8 facing rows × 4 frames.
  * Sheet choice: `frame_index < 4` → `青0`, else `青1`. This is structural for mounted heads
    (the 16×16 idle cells exist only in `青0`; the 16×16 walk cells only in `青1`).
- **Heads**: `青0` holds 4 large 32×32 cells (foot classes) or 4 small 16×16 cells at y=32
  (mounted classes); `青1` holds the matching 8 rows (foot: 32×32 rows y=0…224; mounted: 16×16
  cells x=0…48, y=336…448). Values from the records, cross-checked by rendering.
- **Timing** — delays are 60 Hz ticks (Paragon converts `ms = ticks × 1000/60`):
  * Clip 0 (idle): 4/5/6 keyframes — 26 / 8 / 82 classes; 40–84 ticks total, per-frame delays
    uneven (e.g. Swordmaster 8,10,10,10,1,1; Cavalier 6×10; Axe Fighter 14,14,20,14).
  * Clips 1–8: exactly 4 keyframes in all 116 classes at a uniform 8 ticks (97 classes) or
    10 ticks (19 classes) per frame → clean loops at 133 ms / 167 ms per frame.
  * 6-keyframe variants (many `Unique` files, 9–11 of 34 per slot) are **not extra art**: they
    repeat cells 2 and 1 (`frame_index` runs 4,5,6,7,6,5) as ping-pong holds.
- **Composition geometry** (Body, 4348 frames): body draw offset is always (0,0); head cells are
  32×32 (3183 frames) or 16×16 (1165); head offset relative to the body origin spans
  x −5…+36, y −4…+34. A 44×41 canvas at origin (6,5) covers every frame of every class.
- **Draw order** is unchanged from `anime-bin.md`: head-back band, body, head-front band.

## Facings

Renderings of every frame (foot, mounted, and Unique samples) give this slot map:

| Slot | Facing | Evidence |
|---|---|---|
| 0 | idle, facing camera | front head/body; most clips are 6-frame breathing/sway ping-pong |
| 1 | left | side-profile head cell, weapon to the left |
| 2 | right | mirror of slot 1 (Swordmaster body cells are exact pixel mirrors, diff 0) |
| 3 | down (camera) | front head/body, both legs/horse chest toward camera |
| 4 | up (away) | back of head, no face, horse rump |
| 5 / 6 | down-left / down-right | 3/4 front poses, exact mirrors of each other on symmetric classes |
| 7 / 8 | up-left / up-right | 3/4 rear poses (no face), exact mirrors |

The uniform per-frame delays and the fact that all 8 clips are present on every class (including
staff-only classes) support reading 1–8 as the 8 movement facings rather than walk + attack
clips; no clip in any file holds a strike pose. Caveats: the files store no names, and the
left/right order *within* the two diagonal pairs (5 vs 6, 7 vs 8) is assigned by the art, not by
a game enum. If the planner only ever shows a standing unit, slot 0 (facing camera) is the one
that matters.

## Exceptions / oddities

- `ダークペガサス男/女` (Dark Pegasus): 11 animation records instead of 12.
- `ゴーレム男_ゴーレム男` (Golem Unique): slot 9, 8 keyframes/80 ticks, body `w=h=0` cells — a
  shape that cannot render with the standard 32×32 crop; presumably an effect/placeholder. Not
  needed for the planner.
- `ダミー_ダミー` (Dummy): clips 1–2 are 4 frames, 3–8 are 6-frame ping-pongs.
- Wolf/beast `Unique` forms: 6-keyframe ping-pong clips (plus transform folders `..._変_...`).
- `uses_staff_or_dance` header values: 0 (109 files), 1 (14: flying mounts), 2 (23: staff/dance
  classes), 3 (4: Falcon line + one dragon). No extra sheet exists in `unit/` for any of them, so
  any staff/dance overlay is drawn by another system (effects) and is out of scope.

## Browser extraction — practical

The decoder already parses every clip; extraction needs both sheets (`青0` + `青1`), the
per-frame head offsets, and one encoding decision. Two measured shapes (lossless WebP, Pillow,
native pixels):

| Shape | Payload | Notes |
|---|---|---|
| **Layered (recommended)** | body idle strip 0.4–0.8 KB + 8-facing body strip (32 cells) 2.5–4.8 KB per class; head idle 0.2 KB + 8-facing head strip 0.8–1.2 KB per unit | matches today's `SpriteCell` head-back/body/head-front stack; 116 classes ≈ 0.35–0.65 MB, ~71 unit heads ≈ 0.06–0.1 MB, 34 unique overrides ≈ 0.17 MB → **≈ 0.6–0.9 MB total** (current idle-only sprite payload is 87 KB) |
| Precomposed per unit×class | ≈ 10.6–15.2 KB per combo as 9 animated WebPs, or 4–6 KB as one static 36-frame strip animated with `steps()` | great for a handful of featured combos; across the roster (71 units × 129 classes) it is tens of MB — not practical |

Animation execution is small either way: walking clips are uniform loops, so a strip plus
`background-position` stepping (or a tiny timer) is enough; the idle clips have uneven delays, so
ship them as animated WebP with real per-frame durations (measured 2.2–2.4 KB per idle) or drive
them from a delay table. Direction budget: idle + down covers roster tiles; idle + 4 cardinals
covers previews/hover; the 4 diagonals only matter if the planner ever animates grid movement.
Recommended first cut: **idle + 4 cardinals, layered**, keeping the JSON model open for all 8.

## Samples (generated from the owner's dump for this audit)

- `docs/assets/overworld-animation-audit/contact-sheet.png` — Ryoma·Swordmaster (foot, large
  head) and Xander·Paladin (mounted, small head), all 9 clips, frames in record order.
- `.../ryoma-swordmaster-idle.webp`, `.../xander-paladin-idle.webp` — idle loops with true tick
  delays (e.g. 133/167/167/167/17/17 ms).
- `.../ryoma-swordmaster-walk.webp`, `.../xander-paladin-walk.webp`,
  `.../azura-songstress-walk.webp` — the 8 facings animating in lockstep (4 frames at each
  combo's tick rate: 8 ticks for Ryoma/Xander, 10 for Azura).

All decoding via this repo's `fe_assets.py` + sibling `fe_tools/lz13`; the one external
cross-check is the (already cited) Paragon record layout, used as a documentation reference only.
