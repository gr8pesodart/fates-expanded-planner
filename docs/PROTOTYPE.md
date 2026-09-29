# Prototype — Milestone P

A non-functional but finished-looking, clickable prototype of every v2 page/layout at 390×844 and
≥1024px. It computes nothing: screens read **view-model hooks** built from fixtures, and every
interactive affordance is a callback on the view model. Wiring in M1–M5 = replacing hook bodies
with `plansStore` selectors/actions; screen and component files should not need to change.

Branch: `v2-prototype` (branched from `v2` at M0a; merged by the build orchestrator before M1).

## Seam

| Layer | Location | Rule |
|---|---|---|
| Fixtures | `src/prototype/fixtures.ts`, `gameTables.ts`, `state.ts`, `selectors.ts`, `derive.ts` | Screens never import these. `gameTables.ts` is generated from `src/data/packs/ugf-2.5.2/` by `scripts/gen-game-tables.mjs` (`node scripts/gen-game-tables.mjs`) so ids match the packs. `state.ts` is a prototype-only observable store that makes pins/partner picks/route stops actually change the UI. |
| View models | `src/viewmodels/types.ts` + `useSetupVM`, `useRunsVM`, `usePairingsVM`, `useUnitVM(unitId)`, `useClassRouteVM(unitId)`, `usePreviewVM` | The contract. Every hook returns a typed VM plus callbacks (`onSetPartner`, `onPin`, `onAddStop`, `onEquipSkill`, `onSetCombatPartner`, …). |
| Components | `src/components/*` | Props in, markup out. No store/fixture access. Tokens only, no hard-coded colours. |
| Screens | `src/screens/*` | Presentational composition of components; local UI state only (e.g. which sheet is open is mostly VM state so screenshots can drive it). |

`App.tsx` owns the shell: hash routing, theme (`data-theme` on `documentElement`), route accent
(`data-route` from the run), the lens switcher and the ≥1024px sidebar (`UnitListPane` reads
`usePairingsVM`).

## Screens → routes → hooks → what to wire

| Screen | Route | Hook | VM fields the screen reads | Actions the hook exposes (to wire) |
|---|---|---|---|---|
| Setup + Runs manager | `#/setup` | `useSetupVM()` + `useRunsVM()` | `steps`, `modpacks`, `dlc`, `routes`, `runName`, `dlcWarning`; runs: `runs[]`, `copied`, `shareHint` | `onSelectModpack`, `onToggleDlc`, `onSelectRoute`, `onSetRunName`, `onFinish/onSkip`; runs: `onSelect`, `onDuplicate`, `onDelete`, `onExport`, `onImport`, `onShareLink`, `onCreateRun` |
| Pairings lens | `#/pairings` | `usePairingsVM()` | `runPill`, `query`, `sorts/sortLabel`, `filters`, `units[]`, `empty`, `tray`, `pairCards[]`, `conflicts[]`, `corrin`, `dlc`, `partnerSheet`, `talentSheet` | `onSearch`, `onSetFilter`, `onSetSort`, `onTogglePin`, `onClearFilters`, `onOpenPartnerSheet`, `onSetPartner`, `onOpenTalent`, `onSetCorrinBoon/Bane/Gender`, `onSetCorrinTalent` |
| Individual lens | `#/unit/:id` | `useUnitVM(unitId)` | `sprite`, `className`, `levelLabel`, `relationships[]`, `classGroups[]`, `compare`, `stats` (rows/levels/partnerNote), `skills` (5 slots + personal), `skillPicker`, `inheritance`, `combat`, `combatSheet`, `partnerSheet`, `warnings[]` | `onSetPartner` (S / A+ / Parent), `onSetClass`, `onToggleCompareClass`, `onSetStatLevel`, `onOpenSkillSheet`/`onEquipSkill`, `onSetCombatPartner`, `onSetCombatRole`, `onAddStop`, `onOpenRoute`, `onBack` |
| Class route | `#/unit/:id/route` | `useClassRouteVM(unitId)` | `stops[]` (seal, levels, skills with learn labels, done state), `warnings[]`, `addStopOpen`, `addStopOptions[]` | `onOpenAddStop`, `onCloseAddStop`, `onAddStop(classId)`, `onRemoveStop(index)`, `onOpenUnit`, `onBack` |
| Preview lens | `#/preview` | `usePreviewVM()` | `runPill`, `duoCount/soloCount/unassignedCount`, `duos[]`, `solos[]`, `unassigned[]`, `copied` | `onCopyLink`, `onPrint` |
| Shell (all routes) | — | `usePairingsVM()` | `runPill` (run switch → setup), `units`/`filters`/`query` for the desktop list | `onOpenRuns/onOpenSetup`, `onSearch`, `onSetFilter`, `onTogglePin` |

### View-model contract (summary)

- `SpriteVM { label, src?, tone? }` — `src` stays undefined until the orchestrator wires
  `src/data/assets.json`; the monogram placeholder is the current missing-asset state.
- Actions are per-item callbacks (each chip/row/card carries its own) so the screens never build
  ids from context — the same `ChipButton`, `UnitRow`, `ClassCard`, `RouteStopVM` props can be
  driven by store selectors unchanged.
- Sheets are VM state (`partnerSheet`, `skillPicker`, `combatSheet`, `talentSheet`, `addStopOpen`)
  because they depend on plan context; panel internals are presentational `BottomSheet`.

## Fixtures

- One believable run — **Rainbow run** (UGF 2.5.2, Revelation, DLC on), 22 roster units: Ryoma ×
  Camilla → Shiro; Takumi × Oboro → Kiragi; Corrin (boon Spd / bane Lck / talent Ninja) × Niles →
  Kana; Kaze A+ Saizo; Shiro S Selena; Kiragi's one-sided Selena claim and Subaki's double A+ claim
  are the conflict chips.
- Shiro's route is the reference sample: Spear Fighter 1–10 → Master Seal → Spear Master 1–15 →
  Heart Seal (via Camilla) → Malig Knight 15–20, with the reference stat numbers at Lv 20.
- Partner pickers are backed by the real UGF support graph subset (`PROTO_SUPPORTS`, decoded from
  the pack) with romantic / platonic / fast / S-capable badges, so the sheet is honest about mod
  rules.
- `scripts/shots.mjs` drives all screens/states; `npm run shots` expects a build + preview server
  already running (`npm run build`, `npx vite preview --port 4173 --strictPort`).

## Screenshots (`docs/screenshots/prototype/`)

22 PNGs. Mobile 390×844: `setup-390[-full]`, `pairings-390[-full]`, `pairings-pinned-390`
(compare tray), `partner-sheet-390`, `pairings-filtered-empty-390`, `unit-shiro-390[-full]`,
`unit-shiro-class-compare-390`, `skill-sheet-390`, `route-shiro-390[-full]`, `add-stop-sheet-390`,
`preview-390[-full]`. Desktop 1280×800: `setup-1280`, `pairings-1280`, `unit-shiro-1280`,
`unit-ryoma-1280`, `route-shiro-1280`, `preview-1280`.

## Known gaps (deliberately not wired)

- **Assets**: monogram placeholders everywhere (`VITE_ASSETS` on but no manifest in this branch) —
  the orchestrator merges `public/assets/` + `assets.json` and passes `src` through `SpriteVM`.
- **Maths**: only Shiro's reference block is literal; other stat rows use an honest approximation
  (`base + growth×level`) in `derive.ts`. Child growths are `floor((child + variable parent)/2)`
  from fixture arrays. Projected levels 10/15 change display values but are not route-aware.
- **Plan mutations are prototype-level**: partner/class/skill/route edits update
  `src/prototype/state.ts` only; numbers for a changed variable parent are not recomputed (M1–M4).
- **Add-stop** appends a plausible stop (base → Heart Seal 1–20, promoted → Master Seal 1–20); real
  level/seal validation lands in M4. Route warnings for Lunge / illegal transition are fixture
  driven.
- **Import/export/share** are visual only (`copied` flag); no JSON files or URL-hash share yet.
- **States implemented but not screenshotted**: night theme, Birthright/Conquest accents, DLC-off
  (hides DLC pools + Anna, shows warning chips), missing-asset monograms. Add them to
  `scripts/shots.mjs` when the orchestrator wants them pinned.
- **Accessibility**: real buttons, visible focus, ~44px targets on interactive controls; not yet
  audited (Lighthouse/a11y pass is M6).
- **Preview navigation** stays clickable (slots open the unit) even though editing is absent; print
  stylesheet is basic (`@media print` hides chrome/tray).
