# Prototype and wired implementation

Milestone P established the mobile and desktop screen layouts and the view-model seam. Milestones
M1–M5 have since replaced the fixture-backed hooks with the schema 3 plan store and the installed
UGF dataset. The prototype screenshots remain useful as historical design references; their sample
run and controls are not the runtime data source.

## Production screens

| Screen | Route | Runtime view model | Main decisions |
|---|---|---|---|
| Setup and Runs | `#/setup` | `useSetupVM`, `useRunsVM` | Build, DLC, route, run name, multiple saved runs, JSON import/export, share link |
| Pairings | `#/pairings` | `usePairingsVM` | Search, sort/filter, compare tray, relationship summary/editor, Corrin, children, conflicts |
| Individual | `#/unit/:id` | `useUnitVM(unitId)` | S/A+ partner, class pool and comparison, average stats, five skill slots, combat partner/role |
| Class Route | `#/unit/:id/route` | `useClassRouteVM(unitId)` | Class stops, seal transitions, level ranges, acquired skills and warnings |
| Preview | `#/preview` | `usePreviewVM` | Read-only combat duos, solos, unassigned roster, permanent decisions, print and share |

Screens render view-model props; game and planning rules live in `src/logic/`, and persisted choices
live in `src/state/`. Share tokens decode into a read-only Preview and do not replace the local run.

## Prototype artifacts

- `src/prototype/fixtures.ts`, `gameTables.ts`, `state.ts`, `selectors.ts` and `derive.ts` retain the
  Milestone P mock data and interactions for the screenshot script. Production screens and runtime
  view models do not import them.
- `docs/screenshots/prototype/` contains the original 390×844 and 1280×800 screen captures. The
  captures use a sample plan and document the layout before store wiring.
- `docs/design/reference.html` remains the visual source of truth for tokens and components.

## Implemented and reviewed

- Setup persists schema 3 plans locally and supports run switching, duplication, deletion,
  validation, JSON backup/restore and URL share links.
- Pairings and Individual use the selected modpack support graph and live plan choices. Parent
  selections derive child growths and class inheritance.
- Class Route validates seal eligibility, promotions, level carry, DLC gating and learned skills;
  stop end levels can be edited and later levels recalculate.
- Preview uses saved or decoded shared state, groups front/back combat pairs, solos and unassigned
  units, and disables navigation into edits for shared plans.
- Official assets are resolved through `src/data/assets.json`; missing assets and
  `VITE_ASSETS=off` use monogram fallbacks.

## Current data limitations

The supported gameplay dataset is UGF 2.5.2; Vanilla Special Edition is disabled until its dataset
is available. A+ partner availability is approximated from same-gender A supports. The schema stores
final S/A+ choices but not current support rank, so pair-up rank is inferred as S/A+ or C. Child
support-bonus inheritance and exact inherited-skill timing/order still need a mechanics check. See
[DATA.md](DATA.md) for the sources and open questions.
