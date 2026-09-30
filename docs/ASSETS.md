# Assets pipeline

Official game art makes the planner feel like Fates. Every asset is extracted from the **owner's
own romfs dump** (`../3ds-games/fe-fates/work/cia-extract/romfs/`) by
`tools/assets/extract_assets.py`, converted to WebP and recorded per game id in
`src/data/assets.json`. Nothing is taken from other planners or fan re-uploads; no audio, models or
full textures are used.

`VITE_ASSETS=off` at build/dev time swaps every sprite for a monogram placeholder (the
`Sprite`/`AssetImage` component), so the app still renders without the asset folder.

## Sets, sources and coverage

| Set | Source in the dump | Files | Coverage |
|---|---|---|---|
| Skill icons | `icon/Icon.bch.lz` textures `skill` (512×256) + `skill2` (512×32), 24×24 cells indexed by the Skill table's `icon` field | `public/assets/skills/<skillId>.webp` | **229/229 (100%)** |
| Class sprites | `unit/Body/<jid>/青0.bch.lz` (player-coloured map sprite sheet), rotated 90°, first frame | `public/assets/classes/<classId>.webp` | **125/129 (96.9%)** |
| Unit faces | `face/face/<portrait>_bu.arc` neutral (“通常”) part, hair merged from `face/hair/<hair>/髪0.bch.lz` tinted with the FaceData hair colour, cropped to the BU rectangle from `face/FaceData.bin.lz` | `public/assets/units/<unitSlot>.webp` | **71/71 (100%)** |

Total weight: ≈1.3 MB of WebP (target < 3 MB). Faces are 128×128; class sprites are one frame at
the sheet's native resolution ×4; skill icons ship at their native 24×24.

Missing class sprites (no sprite folder exists in the dump): `None`, `Silent Dragon` (×2) and
`Outrealm Class` — all non-recruitable/enemy-only classes. Corrin (M/F) has no fid in the
character table because the avatar's face is player-configured; the pipeline falls back to the
default avatar face from FaceData (`FSID_BU_マイユニ_男1_顔A` / `_女1_顔A`).

## Decoders — `tools/assets/fe_assets.py`

Self-contained Python (Pillow is the only dependency):

- **LZ13** — reused from the sibling workspace's `fe_tools/lz13.py` (the same codec the data
  extractors use).
- **BinArchive** — little-endian archive used by `GameData`, `FaceData` and the portrait `.arc`
  files: header (size, data size, pointer and label counts), data from 0x20, then the pointer
  table, the label table and a Shift-JIS text section; pointer values above the data size are
  strings at `value + 0x20`.
- **BCH (H3D)** — header, content table, per-texture command stream (size / format / data address)
  and the raw data section. Verified against the reference decoders listed below.
- **CTPK** — parsed for completeness (header + texture info table); not needed for the sets above.
- **PICA200 pixel formats** 0–13: RGBA8/RGB8/RGB5551/RGB565/RGBA4/LA8/HILO8/L8/A8/LA4/L4/A4 in
  8×8 tiles with the PICA200 tile order; **ETC1/ETC1A4** with the two 3DS quirks documented in
  GBATEK: little-endian 64-bit blocks and column-major (x·4+y) pixel order inside each 4×4 block
  (including the 4-bit alpha plane).

Format references used (documentation and cross-checks, not copied code):

- GBATEK, *3DS GPU Texture Formats* (Martin Korth) — ETC1/ETC1A4 bit layout, pixel order.
- 3dbrew, *BinArchive* layout as documented by mila (`thane98/mila`, GPL-3.0) — read as a format
  reference only.
- [3DS-Texture-Forge](https://github.com/ZoomiesZaggy/3DS-Texture-Forge) (MIT) — used to verify the
  BCH/ETC1A4 output pixel-for-pixel while developing the local decoder.

## Regenerating

```bash
python tools/assets/extract_assets.py            # writes public/assets/ + src/data/assets.json
python tools/assets/extract_assets.py --help     # --romfs, --fe-tools, --pack, --out, --manifest
```

The data packs must exist first (`tools/extract/extract_game_data.py`); the script reads
`units.json` / `classes.json` / `skills.json` and writes the manifest next to the app sources.
Verify with `npm test` (manifest coverage + source-per-entry checks).

## Manifest

`src/data/assets.json` maps game ids to files and provenance:

```json
{
  "generatedAt": "…",
  "source": "Owner's romfs dump (work/cia-extract/romfs) via tools/assets/extract_assets.py",
  "coverage": { "skills": { "resolved": 229, "total": 229, "iconCells": 231 }, "…": {} },
  "skills": { "131": { "file": "assets/skills/131.webp", "source": "icon/Icon.bch.lz#skill[12,9] (icon 201)" } },
  "classes": { "31": { "file": "assets/classes/31.webp", "source": "unit/Body/剣聖男/青0.bch.lz" } },
  "units": { "PID_リョウマ": { "file": "assets/units/25.webp", "source": "face/face/リョウマ_bu.arc#通常 + hair" } }
}
```

The resolver (`src/data/assets.ts`) prefixes Vite's `BASE_URL`; files live under `public/assets/`
and are lazy-loaded (and runtime-cached by the service worker on first use — they are not part of
the precache).

## Fallback policy

Extraction covers every set above, so no fallback sources (The Spriters Resource, Serenes Forest,
etc.) were needed. If a set ever regresses, log the fallback and its license here before shipping
it; never pull assets from the reference planners (Marigold, Athnir, soapy4159, hiushi).

Assets are fan-use of Nintendo / Intelligent Systems property. The app carries a “fan-made, not
affiliated” notice and the whole folder can be removed or swapped for monograms with one build
flag.

## Stitched map sprites (v3)

`ClassSprite` is the in-game composition of a class body and the unit's own head, driven by the
class's `anime.bin` idle frame. `tools/assets/extract_sprites.py` (run from the repo root) reads
`unit/Body/<class>/青0.bch.lz` + `unit/Body/<class>/anime.bin`, the character snippets from
`unit/Head/<name>/青0.bch.lz`, and full-body overrides from `unit/Unique/<class>_<unit>/`, and
writes native-pixel WebP plus `src/data/sprites.json`:

| Set | Source in the dump | Files | Coverage |
|---|---|---|---|
| Bodies | `unit/Body/<class>/青0.bch.lz` at the idle frame's body source rect (`anime.bin` animation 0, frame 0) | `public/assets/sprites/bodies/<classId>.webp` | **125/129 (96.9%)** |
| Unit heads | `unit/Head/<fid or avatar>/青0.bch.lz` — the "large" 32×32 cell at (0,0) plus the "small" 16×16 cell at (0,32) | `public/assets/sprites/heads/<slot>.webp`, `…-small.webp` | **71/71 (100%)** |
| Generic heads | `unit/Head/<class folder>/青0.bch.lz` (class-generic art, whichever cells the sheet carries) | `public/assets/sprites/generic-heads/<classId>.webp` | 113/129 |
| Unique overrides | `unit/Unique/<class>_<unit>/青0.bch.lz` idle frame; the body already includes the head | `public/assets/sprites/unique/<slot>-<classId>.webp` | 13 unit×class pairs |

The four body misses are the non-recruitable `None`, the two `Silent Dragon` slots and
`Outrealm Class` — the same gaps the old class-sprites set had. Songstress, monsters and other
body-less classes fall back to their `Unique/<class>_<class>` folder (head `null`). Knights have an
empty generic head sheet in the dump, so they fall back to monograms for the generic art only.

The animation format is documented in [assets/anime-bin.md](assets/anime-bin.md). The idle frame is
`anime.bin` animation 0 / frame 0; the old single-texture class sprites were exactly its body cell.

### Rendering contract (`src/data/sprites.json`)

The texture alpha is the game's layer-priority mask, not opacity, so every composited sprite is
binarised into a **two-cell horizontal strip** of fully opaque pixels: left cell = pixels with
priority `0x66`, right cell = everything above it. `w`/`h` are the cell size (not the strip width)
and `layers: 2` marks the strip.

- `bodies[classId]`: `{ file, w, h, layers?, head, source }`. `head` is
  `{ x, y, variant? }` or `null` when the body already includes a head (Unique/monsters).
  `variant: "small"` means the body places a 16×16 head cell; otherwise the default 32×32 cell is
  used. Bodies with `head: null` are flattened single opaque images without `layers`.
- `heads[unitId]`: `{ file, w, h, layers, source, small? }` — top-level is the large head; `small`
  is the separately drawn mounted-class variant (never rescale one into the other).
- `genericHeads[classId]`: same shape; a mounted class-generic sheet may carry only `small`, in
  which case it is the top-level entry (or omit `small` and use the top-level file).
- `unique[unitId][classId]`: full-body override (flattened, no `layers`); replaces body + head
  entirely.
- Composite the 4-layer stack, bottom to top: body-low, head-low, body-high, head-high (higher
  priority wins, ties go to the head). Draw a box of body `w×h`, body at `(0,0)`, head at `(x, y)`
  in body pixels. Head cells may overflow the box by a few pixels (`y = −2`, `x = 10`), so don't
  clip to the body bounds.

Contact sheet with the 12 gate combos + 4 off-class mounted/foot combos, composed with exactly that
contract at 4× nearest-neighbour: `docs/screenshots/v3/sprites.png` (regenerated by the script).
It renders every mount small-head path (Xander Paladin, Camilla Malig Knight, Ryoma Great Knight,
Xander Wyvern Lord) as well as the Unique overrides (Velouria, Keaton, Kana, Azura).

```bash
python tools/assets/extract_sprites.py            # writes public/assets/sprites + src/data/sprites.json
python tools/assets/extract_sprites.py --help     # --romfs, --fe-tools, --pack, --out, --manifest, --sheet
```

`src/data/sprites.test.ts` pins the coverage (bodies and heads ≥ 90%), that every manifest file
exists on disk, that layered entries are two-cell strips (2× `w`), and that every shipped pixel is
either transparent or fully opaque (pixel decode needs a Playwright Chromium; the extractor also
asserts this while writing). Bodies/heads still render as monograms with `VITE_ASSETS=off`.
