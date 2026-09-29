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

## Talk portraits (v3)

Standing talk sprites back the PortraitChip, the relationship cards and the character pickers
(SPEC › Assets required). `tools/assets/extract_portraits.py` reads the unit list from the data
pack and, for each unit, decodes the neutral (“通常”) part of `face/face/<name>_st.arc`. Hair is
merged the same way as the `_bu` faces: only units whose FaceData record carries a hair part
(Corrin and the second-gen children, whose hair is recoloured by the variable parent) composite
`face/hair/<hair>/髪0.bch.lz` tinted with the FaceData hair colour; everyone else has their hair
baked into the body texture. Corrin M/F have no `fid` and fall back to the default avatar records
`FSID_ST_マイユニ_男1_顔A` / `FSID_ST_マイユニ_女1_顔A`.

| Set | Source in the dump | Files | Coverage |
|---|---|---|---|
| Talk portraits | `face/face/<name>_st.arc` neutral (“通常”) part + hair, trimmed and re-encoded | `public/assets/portraits/<slot>.webp` | **71/71 (100%)** |

Output: 218–268 px wide, 231–269 px tall — the dump's ST textures are 256×256, trimmed to the
content plus the crop boxes and never upscaled (well under the 512 px cap) — as quality-85 WebP
with alpha. Total ≈830 KiB (11.7 KiB average, 17.3 KiB max), comfortably under the 60 KB
per-file target.

### Crop derivation

Each `FSID_ST_*` FaceData record carries the framing the game itself uses: a 128×128 face rect at
record +40 (top of hair to chin), a 110×218 bust rect at +48 and an eye rect at +56.

- **face** — the 128×128 face rect grown by a 10% margin per side: a 154×154 square in texture
  pixels, used by the 24–32px PortraitChip.
- **bust** — a square of the bust rect's height (218), horizontally centred on the bust rect and
  topped at its top edge. That is the game's own bust framing; the eye rect lands at 34% from the
  top on average (25–41% across the roster), matching the ~38% card target from the SPEC.
- **canvas** — the union of the alpha bounding box, the face box and the bust box, so both squares
  always sit inside the image.

Boxes are stored per unit in `src/data/portraits.json`:

```json
{
  "generatedAt": "…",
  "source": "Owner's romfs dump (work/cia-extract/romfs) via tools/assets/extract_portraits.py",
  "coverage": { "resolved": 71, "total": 71 },
  "units": {
    "PID_リョウマ": {
      "file": "assets/portraits/25.webp", "w": 253, "h": 257,
      "face": [53, 0, 154, 154], "bust": [22, 1, 218, 218],
      "source": "face/face/リョウマ_st.arc#通常 + hair"
    }
  }
}
```

### Regenerating

```bash
python tools/assets/extract_portraits.py            # public/assets/portraits + src/data/portraits.json
python tools/assets/extract_portraits.py --help     # --romfs, --fe-tools, --pack, --out, --manifest, --contact-sheet
```

The script also renders `docs/screenshots/v3/portraits.png`: every unit's face crop at 64px and
bust crop at 115px with names, so the crops can be eyeballed in one image. `src/data/portraits.test.ts`
pins coverage ≥ 90%, file existence under `public/`, and square in-bounds boxes.

## Splash art (v3, online)

The character-page header uses **official Fire Emblem Fates artwork**, the one set not taken from
the romfs dump (owner-approved exception, 2026-09-30: "whichever is higher res base artwork").

- **Source:** Fire Emblem Wiki's `FEF_*` files. Per unit, the largest *full* artwork is chosen: the
  wiki's 1000px-tall files are portrait busts and anything under 700px is a thumbnail, so both are
  skipped unless nothing else exists (Anna and Kana only have bust/small art). Serenes Forest has
  larger JPGs (5000px) for Corrin and the royals, but the wiki's versions of those are 2.4–4.8k px
  transparent PNGs — both far exceed the crop we ship, and transparency keeps every header on the
  route-coloured wash, so the wiki is used throughout.
- **Pinned selection:** `tools/assets/splash_sources.json` (file, source page, original size,
  alternatives). `--refresh-sources` re-selects.
- **Crop:** faces are hand-placed in `tools/assets/splash_focus.json` (fractions of the trimmed
  artwork; the anime-face detector missed most of Kozaki's three-quarter faces). The script bakes a
  390:316 header crop about five face-heights tall with the face at 35% height, stored at 2×
  (780×632 WebP q82). Coverage 71/71, ≈3.2 MB total (≈46 KB each, lazy-loaded per character).
- **Review:** `docs/screenshots/v3/splash.png` shows every header crop.
- **Regenerate:** `python tools/assets/fetch_splash.py` (originals cached in the gitignored
  `tools/assets/.cache/splash/`; needs Pillow, numpy, opencv-python).

Licence: official artwork © Nintendo / Intelligent Systems, used as fan reference like the rest of
the asset folder; removable with `VITE_ASSETS=off` or by deleting `public/assets/splash/`.
