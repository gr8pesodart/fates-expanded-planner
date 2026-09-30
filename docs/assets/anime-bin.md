# `anime.bin` — map sprite animation script

Every `unit/Body/<class>/` folder (and most `unit/Unique/<class>_<unit>/` folders) ships an
`anime.bin`: the script that places the class body cells and the unit head cells for each map
animation. It is the file that makes a head land on a body, and `extract_sprites.py` reads its
first frame to emit the idle body/head pair.

The file is a BinArchive-shaped blob: `u32 size`, `u32 data_size`, `u32 pointer_count`,
`u32 label_count` at `+0x00`, data at `+0x20` (pointer/label counts are 0 in every dump file). The
data itself is:

## Global header (8 bytes at `0x20`)

| Offset | Type | Meaning |
|---|---|---|
| `+0x00` | `i32` | `uses_staff_or_dance` — non-zero for classes with a staff/dance overlay (Songstress = 2, Pegasus line = 1) |
| `+0x04` | `i32` | animation count (12 in almost every file; Dark Pegasus ships 11) |

`data_size = 8 + count * 388`, which is the whole payload (e.g. 4696 = 0x20 + 8 + 12·388).

## Animation record (388 bytes, `0x184`)

| Offset | Type | Meaning |
|---|---|---|
| `+0x00` | `u8` | `is_used` (0 = slot not authored; blocks 9–11 are unused on every class) |
| `+0x01` | `i8` | `frame_count` — keyframes in this clip |
| `+0x02` | `i8` | `total_frames` — sum of the keyframe delays |
| `+0x03` | `i8` | padding |
| `+0x04` | 16 × 24B | frame records, fixed-size slot array (unused slots are zero) |

Animation 0 is the standing/idle clip; each later used clip is one movement set (walk directions
are separate clips). `frame_count`/`total_frames` are consistent across the dump: e.g. Swordmaster
idle = 6 keyframes / 40 ticks (8+10+10+10+1+1), Axe Fighter idle = 4 / 62, Pegasus idle = 4 / 52.

## Frame record (24 bytes)

| Offset | Type | Field | Meaning |
|---|---|---|---|
| `+0x00` | `i8` | `body_draw_offset_x` | body cell screen offset (0 on every idle frame) |
| `+0x01` | `i8` | `body_draw_offset_y` | |
| `+0x02` | `i8` | `body_width` | body source cell size (always 32×32) |
| `+0x03` | `i8` | `body_height` | |
| `+0x04` | `i16` | `body_source_position_x` | body cell top-left in the **rotated** sheet |
| `+0x06` | `i16` | `body_source_position_y` | |
| `+0x08` | `i8` | `head_draw_offset_x` | head cell screen offset relative to the body origin |
| `+0x09` | `i8` | `head_draw_offset_y` | (negative = up; `0xFE` = −2) |
| `+0x0A` | `i8` | `head_width` | head source cell size: 32 (foot classes) or 16 (mounted classes), 0 for Unique bodies |
| `+0x0B` | `i8` | `head_height` | |
| `+0x0C` | `i16` | `head_source_position_x` | head cell top-left in the **rotated** head sheet |
| `+0x0E` | `i16` | `head_source_position_y` | |
| `+0x10` | `i32` | `frame_index` | global keyframe number across the file (0..35) |
| `+0x14` | `i32` | `frame_delay` | hold time in 60 fps ticks |

Source positions are in the frame the app renders, i.e. after the same `rotate(90°, expand)`
transform the existing class-sprites pipeline applies to `青0.bch.lz`. Animation 0's coordinates
address the small `青0` sheets; the later clips address the large `青1` sheets (e.g. the Swordmaster
walk clips source body cells at `x = 0/32/64/96, y = 32..224` of the rotated 128×512 `青1` sheet).

## The idle frame

`animation[0].frames[0]` is the standing pose:

- Body: source `(0, 0)`, 32×32 — the exact crop the v1/v2 class sprites shipped (the rotated
  sheet's top-left cell).
- Head (foot classes): source `(0, 0)`, 32×32 — the head sheet's top-left "large" cell.
- Head (mounted classes): source `(0, 32)`, 16×16 — the head sheet's bottom-left "small" cell, drawn
  at an offset such as `(10, 0)` where the rider's neck is.
- Head (Unique overrides): `head_width = head_height = 0`; the body already contains the head.

Every one of the 116 `Body` folders and 34 `Unique` folders has an idle frame whose body source is
`(0, 0)`; 84 classes use the 32×32 head cell and 31 use the 16×16 cell. The small head is
separately drawn art (Ryoma: 13×17 px large vs 11×15 px small), not a scaled copy, so both variants
ship and the body says which one it needs (`head.variant`).

## Draw order

The textures' alpha channel is not opacity. On **heads** it splits the art into the layer behind
the body and the layer in front of it; the body itself draws whole in between:

1. head back layer — `0x66` (long hair, pony tails) and `0xEE` (recolourable long hair)
2. body — every pixel
3. head front layer — `0x88` (face, fringe) and `0xFF` (recolourable front hair)

`0xEE`/`0xFF` only occur on heads with recolourable hair (Corrin, Kana, and the children whose hair
follows their second parent; also Azama): the hair is stored grey and tinted at runtime.

This was reached by elimination against the art, after two wrong readings: "brighter = closer,
head wins ties" drew Corrin (F)'s `0xEE` hair over her body, and treating `0x66`/`0x88` as
per-pixel priorities with head-wins ties still drew Charlotte's, Izana's and Nyx's `0x66` long hair
over their `0x66` bodies. The sandwich keeps every long-haired infantry unit's hair behind the body
and every mounted rider's `0x88` face in front of the mount.

`extract_sprites.py` ships bodies as one opaque image (`layers: 1`) and heads as a two-cell
`[back | front]` strip (`layers: 2`), fully opaque pixels. Unique bodies have no head and ship
flattened (no `layers`). Recolourable hair is tinted with the unit's default FaceData hair colour at
extraction (the talk-portrait tint); per-run colours are backlogged.

## Evidence

- Byte-level parse cross-checked on `剣聖男`, `アクスファイター女`, `天馬武者女`, `ソシアルナイト男`,
  `マーナガルム男`, `九尾の狐女`, `ガルー女_ベロア`, `歌姫女_アクア` and `ダークブラッド女_カンナ女`
  (header values, keyframe counts, delay sums and source rectangles all line up).
- All 125 classes with a body, 13 unit×class Unique overrides and all 71 unit head sheets resolve an
  idle frame; rendering the contract (body at (0,0), head at its offset) reproduces the in-game
  sprite on the 16-combo contact sheet (`docs/screenshots/v3/sprites.png`).
- Layout confirmed against Paragon's FE14 `Sprite` type definition (thane98, GPL-3.0) as a
  documentation reference only; the parser here is written from the byte-level checks above.
