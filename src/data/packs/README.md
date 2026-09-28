# Dataset packs

Generated game/mod data lives here, one directory per pack id. Do not hand-edit generated files —
change the extractor and rerun it.

- `ugf-2.5.2/` — characters + support graph extracted from the installed Unofficial Gay Fates
  build. Regenerate with `python tools/extract/extract_ugf_supports.py`.

Format and provenance rules are documented in [docs/DATA.md](../../../docs/DATA.md); the
TypeScript shapes are in [src/data/types.ts](../types.ts).
