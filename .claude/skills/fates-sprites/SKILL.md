---
name: fates-sprites
description: Work with Fire Emblem Fates map sprites from the owner's romfs dump — decode unit/Body and unit/Unique anime.bin animation scripts, stitch class bodies with unit heads (large/small variants, Unique overrides), apply the layer-priority alpha rules, regenerate public/assets/sprites + src/data/sprites.json + the contact sheet, and verify with src/data/sprites.test.ts. Use when touching tools/assets/extract_sprites.py or fe_assets.py, src/data/sprites.json, src/data/art.ts, src/components/art.tsx, docs/assets/anime-bin.md, ClassSprite rendering, recolourable hair, or any Fates BCH/LZ13 sprite task.
---

# Fates map sprites from the dump

FE Fates builds a map sprite from three files: a **class body sheet**, a **character head sheet** and
the class's **`anime.bin`** script that positions one over the other. `tools/assets/extract_sprites.py`
reads those and writes native-pixel strips the app stitches at runtime. The authoritative format notes
are `docs/assets/anime-bin.md`; this skill is the working summary and the pitfalls.

## Where everything lives

| Thing | Path |
|---|---|
| Dump (owner's romfs) | `D:\Local Work\Dev Projects\3ds-games\fe-fates\work\cia-extract\romfs` |
| Body sheets | `unit/Body/<class folder>/青0.bch.lz` (32×128 = 4 cells) + `青1.bch.lz` (512×128, walk/attack) + `anime.bin` |
| Head sheets | `unit/Head/<character>/青0.bch.lz` (64×128 = large 32×32 cells in the top row, small 16×16 cells in the bottom row) + `青1.bch.lz` (512×128) |
| Unique overrides | `unit/Unique/<class folder>_<character>/` — full body (head included), own `anime.bin` |
| Extractors | `tools/assets/extract_sprites.py`, decoders in `tools/assets/fe_assets.py`, FaceData/hair tint in `tools/assets/extract_portraits.py` |
| App contract (v3 app line) | `src/data/sprites.json` → `src/data/art.ts` → `src/components/art.tsx` (`ClassSprite`); a pre-v3 checkout may still resolve through `src/data/assets.ts` |
| Tests / docs | `src/data/sprites.test.ts`, `docs/assets/anime-bin.md`, `docs/ASSETS.md` › Stitched map sprites, `docs/screenshots/v3/sprites.png` |

Colours: `青` = player blue (the only set extracted), `赤`/`緑`/`紫` = enemy/ally palettes. Sheets are
BCH inside LZ13; decode with `fe_assets.bch_textures(lz13.decompress(...))` and always
`.rotate(90, expand=True)` before cropping — **all `anime.bin` source coordinates are in the rotated
frame**.

## Commands

```bash
# absolute paths matter: ../3ds-games does not resolve from a paseo worktree
python tools/assets/extract_sprites.py \
  --romfs "D:\Local Work\Dev Projects\3ds-games\fe-fates\work\cia-extract\romfs" \
  --fe-tools "D:\Local Work\Dev Projects\3ds-games\fe-fates\tools" \
  --pack src/data/packs/ugf-2.5.2

npm run lint && npx tsc -b && npm test && npm run build
```

On Windows set `PYTHONIOENCODING=utf-8` and run npm/npx from PowerShell. The extractor prints a
coverage report and rewrites the manifest and contact sheet.

## `anime.bin` in one screen

BinArchive-shaped: `u32 size/data_size/pointers/labels` at `+0`, data at `0x20`. Then:

- 8-byte global header: `i32 uses_staff_or_dance`, `i32 animation_count`
- `animation_count` × 388-byte animations: `u8 is_used, i8 frame_count, i8 total_frames, i8 pad`, then
  **16 fixed 24-byte frames**
- frame: `i8 body_dx, body_dy, body_w, body_h; i16 body_src_x, body_src_y; i8 head_dx, head_dy, head_w,
  head_h; i16 head_src_x, head_src_y; i32 frame_index; i32 frame_delay` (60 fps ticks)

**Idle = animation 0**: four distinct cells (0–3) looped with the game's own uneven delays; body cells
`(i×32,0,32,32)`, head either 32×32 at `(i×32,0)` (foot classes, 84) or 16×16 at `(i×16,32)`
(mounted/some classes, 31), head offset like `(0,−2)` / `(10,0)` and it can bob between poses. The
head cell always equals the body cell (`animation_contract` asserts it). `head_w/h = 0`
means the Unique body already contains the head. Animation 0 addresses the small `青0` sheets; later
clips address `青1`.

## Heads: two variants, no rescaling

- Unit → folder: `FID_リョウマ` → `リョウマ`; Corrin → `プレイヤー男1_01` / `プレイヤー女1_01`.
- Large cell = rotated `(0,0,32,32)`; small = rotated `(0,32,16,48)`. The small head is separately
  drawn art (Ryoma: 13×17 vs 11×15 px) — **never scale one variant into the other**; the body says
  which it needs via `head.variant: "small"`.
- Generic per-class heads are Head folders named after the class folder (`剣聖男`, `ソシアルナイト男`,
  `天馬武者女`…). Some sheets carry only one variant (mounted class-generic sheets are small-only), and
  the Knight generic sheet is empty — fall back to monograms, not to a unit head.

## Draw order — the rule that took three tries

The texture alpha is a **layer mask, not opacity**. Do not ship raw alpha in WebP: browsers draw
0x66 pixels at 40% and the sprites look dim. The correct composition is a sandwich:

1. head back layer — `0x66` (long hair, ponytails) and `0xEE` (recolourable long hair)
2. body — every pixel, whole
3. head front layer — `0x88` (face, fringe) and `0xFF` (recolourable front hair)

`0xEE`/`0xFF` are the **recolourable-hair mask** (Corrin, Kana, children inheriting hair, Azama):
hair is stored grey and tinted at extraction with the unit's FaceData default
(`extract_portraits.parse_face_data` → `extract_sprites.tint_hair` → `extract_portraits.tint_overlay`).
v3.3: the extractor also writes the **untinted hair pixels** as a same-layout `-hair` strip (entry
`hair`; heads, small heads, Unique bodies) and `hairColours` (FaceData colour per unit). `ClassSprite`
(`art.tsx › useHairColour / useTintedHair / tintHair`) tints **only the hair strip** on a canvas
(object URL cached per (hair strip, colour)) and draws it as an extra cell over each head band (and
over Unique bodies), so a failed tint can never remove a head. iPhone trap (v3.3): WebKit fired
`load` before decode while the page was busy and `drawImage` painted nothing — the old full-strip
tint baked blank heads for the colour in use at startup. `loadImage` now awaits `decode()` and blank
reads retry. Colour rule:
`logic/hair.ts › hairColourOf` (Corrin's swatch; children = variable parent's colour). Keep the
runtime maths identical to `extract_sprites.tint_ramp` (`min(255, grey·c // 0xBB)`). History — don't
repeat: overlay washed hair out (greys ≥ 0x80 → white); ×2 modulate clipped light colours to pure white
(owner saw "heads missing" on iPhone). 0xBB is calibrated on hand-drawn first-gen sprite hair, which
sits at ~0.5–1.1× its FaceData colour's lightness.
Portraits still use overlay. The Parents tab draws the child with each candidate's colour (`hair` prop).
Corrin's swatches: ROM `GameData/MyUnitEdit.bin.lz` › `カラーテーブル` (30 × RGBA) →
`sprites.json › corrinHairColours` (`corrin_hair_swatches`). Animation timing: every `ClassSprite`
reads one shared clock at its class's native loop length (`art.tsx › frameAt`), so sprites sharing a
loop length restart together and copies of a class stay in step; different lengths drift (owner
ruling — a single stretched 64-tick cycle was tried and dropped). Loop lengths follow the sprite sheet
/ class line, not movement type (e.g. pegasi 52, wyverns 58, horses 60, Samurai M 68 vs F 46).

Recorded wrong readings (do not revive): (a) "brighter = closer, head wins ties" drew Corrin (F)'s
`0xEE` hair over her body; (b) treating every value as a per-pixel priority with head-wins ties still
drew Charlotte's, Izana's and Nyx's `0x66` long hair over their `0x66` bodies. Long hair must go
**behind** the body; a mounted rider's face must stay in front of the mount.

Encoding: strips are frame-major, then layer bands. Bodies ship four opaque cells (`frameCount: 4`,
`layers: 1`), heads four `[back | front]` pairs per size (`frameCount: 4`, `layers: 2`, cell width
`w`), Unique bodies four flattened cells with no `layers`. `layer_strip()` rejects any
unexpected alpha value.

## Rendering contract

`src/data/art.ts` + `ClassSprite` (`src/components/art.tsx`):

- `spriteLayers(unitId, classId)` → `{kind:'single', image}` (Unique/legacy) or
  `{kind:'stitched', body, head, offset}`; generic heads fill in when the unit has no named head.
- Composite back to front: head band 0, body, head band 1; each band is picked with
  `background-position` (`SpriteCell`). The head may overflow the body box (negative offsets), never
  clip it.
- **Cache-busting**: every art URL carries `?v=<manifest.generatedAt>`. The service worker caches
  `assets/**/*.webp` CacheFirst by URL (`vite.config.ts`, regex must allow the query string, cache
  name `game-assets-v2`). Regenerating files under unchanged names without this suffix serves stale
  strips to returning browsers — that produced "displaced heads/bodies" bug reports once already.
- **Animation**: each body's `animation` is compact — `[cell, delay]`, or `[cell, delay, headX, headY]`
  when the head leaves the body's rest offset (`compact_animation` strips redundancy because the
  manifest ships in the main bundle, and fails if its invariants break). `ClassSprite` plays it only
  while on screen and stops under `prefers-reduced-motion` / a hidden tab.
- **Whole-number scales only** (owner rule, v3.2): `ClassSprite` uses
  `scale = max(1, floor(size / 32))`, so pass sizes that are multiples of 32 (32 = 1×). Roster and
  Chart use 32; a 24/28 size would round to 1× and overflow its box.
- **Head and body appear together** (v3.2): `ClassSprite` decodes every image a sprite needs
  (`useImagesReady` / `decodeImage`, a module-level cache) and renders an empty, size-holding box
  until all are decoded, so a headless body or floating head never flashes in. Cached sprites render
  immediately.
- `VITE_ASSETS=off` must still render monograms.

## Extraction gotchas

- Class folder resolution: `JID_アクスファイター男` → `アクスファイター男`, then the trailing 男/女
  trimmed (`アクスファイター`); then Unique fallback `<classFolder>_...` for body-less classes
  (Songstress, Faceless, monsters). `None`, `Silent Dragon` ×2, `Outrealm Class` have nothing.
- Unique per unit×class = exact `unit/Unique/<class folder>_<fid name>/`; skip `_変_` transform
  folders. Expected pairs: 13.
- Coverage baseline: bodies 125/129, heads 71/71 (large+small), generic heads 113/129, unique 13;
  hair strips: 24 large heads, 23 small, 9 Unique (pinned in `sprites.test.ts`).
- The contact sheet (`docs/screenshots/v3/sprites.png`) is the visual gate: 16 combos including
  mounted small-head paths and Unique overrides, composed with the same `compose_contract` at 4×
  nearest-neighbour. It must be regenerated with the sprites.
- After regeneration, restart any running dev server — it can keep serving blank/old files.

## Verify before shipping

1. `npm run lint && npx tsc -b && npm test && npm run build`.
2. `src/data/sprites.test.ts` pins coverage, file existence, strip width (`w × frameCount × layers`)
   from the WebP header, the compact animation frames, and the small-variant flags; `extract_sprites.py` asserts binary alpha while writing.
3. Eyeball `docs/screenshots/v3/sprites.png` for layering regressions: long-haired infantry hair behind
   the body, mounted faces in front of the mount, no dim/transparent sprites.

Related: `fe-fates-modding` (global skill) covers the broader game-data/modding workflow.
