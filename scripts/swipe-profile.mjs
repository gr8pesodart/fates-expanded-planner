/**
 * Profiles a horizontal swipe on each swipe screen (Roster lens, Chart tab, character tabs) under CPU
 * throttling: frame times while dragging and after release, style/layout/script totals, long tasks.
 * Run against a production build (dev React is several times slower):
 *
 *   npm run build; npx vite preview --port 4199 --strictPort
 *   node scripts/swipe-profile.mjs            # BASE, THROTTLE (default 4), ONLY=<label part>
 *   TRACE=1 ...                               # + Chrome trace totals (drag / settle)
 *   PROFILE=1 ...                             # + top JS self-time (build with --minify false)
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:4199'
const THROTTLE = Number(process.env.THROTTLE ?? 4)
const KEY = 'fates-expanded-planner:plans:v4'
const CORRIN = 'PID_プレイヤー女'
const JAKOB = 'PID_ジョーカー'
const RYOMA = 'PID_リョウマ'
const CAMILLA = 'PID_カミラ'
const plan = (extra = {}) => ({ skills: [null, null, null, null, null], reclasses: [], ...extra })
const now = '2026-09-30T00:00:00.000Z'
const run = {
  id: 'demo', name: 'Perf', modpackId: 'ugf-2.5.2', dlc: true, route: 'revelation',
  corrin: { gender: 'female', builds: { female: { boon: 'spd', bane: 'lck', talentClassId: 34 }, male: { boon: 'spd', bane: 'lck', talentClassId: 33 } } },
  favourites: [],
  units: {
    [CORRIN]: plan({ sPartner: JAKOB, pairPartner: JAKOB, pairRole: 'front', skills: [53, 59, 21, 30, 43] }),
    [JAKOB]: plan({ sPartner: CORRIN, pairPartner: CORRIN, pairRole: 'back' }),
    [RYOMA]: plan({ sPartner: CAMILLA, pairPartner: CAMILLA, pairRole: 'front' }),
    [CAMILLA]: plan({ sPartner: RYOMA, pairPartner: RYOMA, pairRole: 'back' }),
  },
  createdAt: now, updatedAt: now,
}
const seeded = JSON.stringify({ state: { schema: 5, runs: [run], activeRunId: 'demo', onboarded: true }, version: 5 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, serviceWorkers: 'block' })
await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, seeded])
const page = await context.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
const cdp = await context.newCDPSession(page)
await cdp.send('Performance.enable')

const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

async function swipe(label, hash, y, dir = -1) {
  console.log(`\n== ${label} (cpu x${THROTTLE})`)
  await page.goto(`${BASE}/#/${hash}`)
  // A hash-only goto doesn't reload, and the previous case's observers would report twice.
  await page.reload()
  await page.locator('.screen').first().waitFor()
  await sleep(2500)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.evaluate(() => {
    window.__frames = []
    window.__long = []
    let last = performance.now()
    const loop = (t) => { window.__frames.push([t, t - last]); last = t; window.__raf = requestAnimationFrame(loop) }
    window.__raf = requestAnimationFrame(loop)
    new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__long.push([e.startTime, e.duration]))).observe({ type: 'longtask' })
  })
  const before = await metrics()
  if (process.env.TRACE) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] })
  if (process.env.PROFILE) {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await cdp.send('Profiler.start')
  }
  const t0 = await page.evaluate(() => performance.now())
  const x0 = 300
  await touch('touchStart', x0, y)
  for (let i = 1; i <= 16; i += 1) {
    await touch('touchMove', x0 + dir * i * 12, y)
    await sleep(16)
  }
  const tRelease = await page.evaluate(() => performance.now())
  await touch('touchEnd', 0, 0)
  await sleep(1200)
  if (process.env.PROFILE) {
    const { profile } = await cdp.send('Profiler.stop')
    const self = {}
    const byId = new Map(profile.nodes.map((n) => [n.id, n]))
    const dt = profile.timeDeltas
    profile.samples.forEach((id, i) => {
      const f = byId.get(id).callFrame
      const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`
      self[key] = (self[key] ?? 0) + (dt[i] ?? 0) / 1000
    })
    const top = Object.entries(self).filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 18)
    for (const [k, ms] of top) console.log(`    ${ms.toFixed(1).padStart(7)}ms  ${k}`)
  }
  if (process.env.TRACE) {
    const buffer = await browser.stopTracing()
    const events = JSON.parse(buffer.toString()).traceEvents
    const main = events.filter((e) => e.ph === 'X' && e.dur)
    const releaseTs = events.find((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'pointerup')?.ts ?? Infinity
    const sum = (filter) => {
      const totals = {}
      for (const e of main.filter(filter)) totals[e.name] = (totals[e.name] ?? 0) + e.dur / 1000
      return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([n, ms]) => `${n}=${ms.toFixed(0)}`).join(' ')
    }
    console.log(`  trace drag:   ${sum((e) => e.ts < releaseTs)}`)
    console.log(`  trace settle: ${sum((e) => e.ts >= releaseTs)}`)
  }
  const after = await metrics()
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const { frames, long } = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return { frames: window.__frames, long: window.__long } })
  const phase = (from, to) => frames.filter(([t]) => t >= from && t < to).map(([, d]) => d)
  const stat = (ds) => ds.length ? `n=${ds.length} avg=${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1)} max=${Math.max(...ds).toFixed(0)} >33ms=${ds.filter((d) => d > 33).length}` : 'n=0'
  const d = (k) => ((after[k] - before[k]) * 1000).toFixed(0)
  console.log(`  drag   frames: ${stat(phase(t0, tRelease))}`)
  console.log(`  settle frames: ${stat(phase(tRelease, tRelease + 1200))}`)
  console.log(`  ms: script=${d('ScriptDuration')} style=${d('RecalcStyleDuration')} layout=${d('LayoutDuration')} task=${d('TaskDuration')} styleCount=${after.RecalcStyleCount - before.RecalcStyleCount} layoutCount=${after.LayoutCount - before.LayoutCount}`)
  console.log(`  long tasks: ${long.map(([s, dur]) => `${(s - t0).toFixed(0)}+${dur.toFixed(0)}`).join(' ') || 'none'}`)
  console.log(`  nodes: ${after.Nodes}`)
}

const unit = (id, tab) => `unit/${encodeURIComponent(id)}/${tab}`
const only = process.env.ONLY
const cases = [
  ['roster lens', 'roster', 500],
  ['chart tab', 'chart', 500],
  ['character tab (Ryoma profile)', unit(RYOMA, 'profile'), 600],
  ['character tab (Corrin profile)', unit(CORRIN, 'profile'), 600],
]
for (const [label, hash, y] of cases) if (!only || label.includes(only)) await swipe(label, hash, y)
await browser.close()
