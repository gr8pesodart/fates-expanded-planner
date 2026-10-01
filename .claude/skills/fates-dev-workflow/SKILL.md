---
name: fates-dev-workflow
description: How to build, verify, screenshot, commit and deploy the Fates Expanded Planner on the owner's Windows machine, plus the environment traps that have repeatedly cost time (node only in PowerShell, Vite serving stale/half-written modules, screenshot file locks, ports owned by other worktrees) and how the owner likes work run (delegation, push rules, iPhone PWA testing). Use at the start of any session in this repo, before running npm/vitest/Playwright, before committing or pushing, and when delegating to other agents.
---

# Fates planner — dev workflow and traps

Read `AGENTS.md` first (product rules, conventions, data paths). This skill is the operational
knowledge that isn't obvious from the code. Sibling skills: `fates-mechanics` (verified game rules),
`fates-ui-patterns` (screen architecture and design decisions), `fates-sprites` (map sprite pipeline).

## Environment (Windows 11)

- **Node/npm/npx only work in PowerShell.** In Git Bash `npm run …` fails with
  `'"node"' is not recognized`. Use the PowerShell tool for `npm`, `npx`, `node`; Git Bash is fine for
  `git`, `grep`, `sed`, `python`.
- Python 3.13 is on PATH. Printing Japanese PIDs from Python in PowerShell needs
  `$env:PYTHONIOENCODING='utf-8'` (default cp1252 raises `UnicodeEncodeError`).
- Python heredocs inside Bash mangle escaped apostrophes: a JS string like `'Corrin\'s'` written from a
  `<<'EOF'` heredoc lost its backslash twice and broke the test file. Use double-quoted JS strings or
  the Edit tool.
- `git` warns "LF will be replaced by CRLF" on every file — harmless.
- Data sources live in the sibling workspace `../3ds-games/fe-fates/` (see AGENTS.md table).

## Gates (must be clean before calling anything done)

```powershell
npm run lint      # oxlint — warnings count as failures for this repo
npm run build     # tsc -b && vite build; also warns if the main chunk exceeds 500 kB
npm test          # vitest; only src/**/*.test.ts is collected (vitest.config.ts)
```

- Throwaway probe tests must live under `src/` (e.g. `src/zz-probe.test.ts`, imports `./data/loader`)
  or vitest won't find them. Delete them afterwards.
- Throwaway Playwright scripts in `scripts/_*.mjs` are linted by oxlint (unused imports warn) —
  delete them before the final lint.
- The main bundle sits near the 500 kB warning; `src/data/sprites.json` is in it. Keep manifest data
  compact (see `fates-sprites` › compact animation).

## The Vite stale-module trap (cost several debugging rounds)

The dev server (`npm run dev`, port **5173**, usually already running from an earlier session) can
cache a module **mid-write**. Symptoms: a screen crashes with "X is not defined" / "does not provide
an export named …" / `Cannot read properties of undefined` while `tsc` and tests pass.

- Cause: scripted edits that truncate-then-write, or **several writes to one file in quick
  succession** (a Python script doing one `open(...,'w')` per replacement). Vite keeps an empty or
  intermediate version.
- Prefer the **Edit/Write tools**; if you script, write each file once (or atomically via temp file +
  `os.replace`, which can itself fail with `PermissionError` if the watcher holds the file).
- Detect: `(Invoke-WebRequest "http://localhost:5173/src/<file>" -UseBasicParsing).Content.Length`
  (~170 bytes = empty), or grep the served module for a symbol you just added.
- Fix without restarting: re-save the file
  (`$c=[IO.File]::ReadAllText($p); [IO.File]::WriteAllText($p,$c)`) for every changed file, wait ~1s.
- Restarting is fine too, but check who owns the port first (next section).

## Ports and other worktrees

- **5173**: this checkout's dev server (check before assuming).
- **4173**: owned by a `vite preview` from the `v2-prototype` worktree — **not this app**. A test once
  ran against it by mistake. Use another port (e.g. `npx vite preview --port 4199 --strictPort`).
- Check ownership: `Get-NetTCPConnection -LocalPort <p> -State Listen` → `Get-CimInstance Win32_Process
  -Filter "ProcessId=<pid>"` and read `CommandLine`. Only stop processes whose command line is this
  repo's path.
- Paseo worktrees live in `C:\Users\jacob\.paseo\worktrees\2vplw8a2\<slug>`; all v3 lanes are merged.

## Screenshots and browser checks

- `npm run shots` (needs the dev server) writes 23 screens to `docs/screenshots/v3/`. Writing there
  directly often fails with `UNKNOWN: unknown error, open …png` (Windows file lock). Use
  `$env:SHOT_OUT="$env:LOCALAPPDATA\Temp\v31shots"`, then copy the PNGs over.
- A failed/timeout shot usually means a runtime crash — reproduce with a small Playwright script that
  logs `pageerror` (seed localStorage key `fates-expanded-planner:plans:v4`; copy the seeding block from
  `scripts/shots.mjs`).
- Full-page captures render fixed elements (nav bar, sticky headers) mid-page — artifact, not a bug.
- Touch gestures: Playwright's touchscreen only taps; send swipes with CDP
  `Input.dispatchTouchEvent` on a `hasTouch`/`isMobile` context. WebKit for Playwright is installed
  (`npx playwright install webkit`) — use it for iOS-ish checks.

## Data regeneration rule

Never hand-edit generated pack files (`src/data/packs/**`, `src/data/*.json` manifests). Change the
extractor or curated source and rerun, e.g. `python tools/extract/build_recruitment.py` (reads
`tools/extract/curated/recruitment.source.json`).

## Commits, branches, deploy

- Work on branch **`v3`**. `main` is the deploy branch; GitHub Pages deploys on push to `main`
  (`.github/workflows/deploy.yml`, runs lint + build).
- **Commit/push only when the owner asks.** "Push" = fast-forward: confirm
  `git merge-base --is-ancestor origin/main v3`, then `git push origin v3:main`, then
  `git branch -f main origin/main`.
- Commit messages end with `Co-Authored-By: <model> <noreply@…>`.
- After pushing: `gh run watch <id> --exit-status`, then confirm the live bundle matches a local build
  (compare `assets/index-*.js` in `dist/index.html` with the live page HTML at
  https://gr8pesodart.github.io/fates-expanded-planner/).

## PWA updates (the owner tests on an iPhone home-screen app)

- Service worker: `skipWaiting` + `clientsClaim` (vite.config.ts). `src/app/pwa.ts` re-checks for a new
  build on every `visibilitychange` → visible (throttled to 1/min) and hourly, and `registerSW`
  (autoUpdate) reloads when the new worker takes control. iOS home-screen apps *resume* rather than
  relaunch, which is why this exists. Verified end to end (build A → rebuild → visibilitychange →
  reload onto build B).
- Art URLs carry `?v=<manifest.generatedAt>` (runtime cache is CacheFirst by URL).

## Delegation (owner's standing preferences)

- The owner is cost-conscious. Profiles (Paseo `list_profiles`): **DS** = DeepSeek V4.1 Flash (cheap
  builder/researcher, opencode), **Luna** = GPT Luna (open-web/Reddit research, network access,
  codex), Sol/GLM/Astra exist for heavier work. Usual split: web research → Luna (read-only, report in
  final message), tedious UI tasks → DS **in its own worktree branch** (avoids CSS conflicts), hard
  design/debug work → the orchestrator. Review and merge delegated branches yourself.
- Give delegated agents exact file pointers and the gates; tell them not to push/merge and which
  ports to avoid.
- Research claims must carry quotes + URLs; record outcomes in `docs/DATA.md` and pin them in tests.

## Owner preferences learned

- Follow `docs/design/SPEC.md` (from Figma `bT3rsrSL9exw83MYWzMF73`); selected states use the route
  accent even where a Figma mock shows grey.
- Report honestly what was and wasn't verified (desktop browsers can't reproduce some iOS issues).
- Third-party assets need licences logged in `docs/ASSETS.md` (one icon is CC BY 3.0 and needs credit).
