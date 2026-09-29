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
