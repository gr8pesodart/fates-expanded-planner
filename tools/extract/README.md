# Extraction tools

Plain-stdlib Python scripts that turn files from the companion fe-fates build into dataset packs
for the app. Run them from the repo root; they print counts and write into `src/data/packs/`.

| Script | Input | Output |
|---|---|---|
| `extract_ugf_supports.py` | `Unofficial Gay Fates v2.5.2/Paragon Imports/UGF.json` | `src/data/packs/ugf-2.5.2/` |

The source path defaults to the sibling workspace (`../3ds-games/fe-fates/...`); override with
`--source` if the build moved. Details, decode rules and verification notes: [docs/DATA.md](../../docs/DATA.md).
