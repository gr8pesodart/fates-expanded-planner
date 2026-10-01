/**
 * Captures every v3 screen/state into docs/screenshots/v3/ at 390×844 and 1280×800.
 * Expects a dev or preview server (SHOT_BASE, default http://localhost:5173).
 *
 *   npm run shots
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5173'
const OUT = process.env.SHOT_OUT ?? 'docs/screenshots/v3'
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }
const KEY = 'fates-expanded-planner:plans:v4'

const CORRIN = 'PID_プレイヤー女'
const JAKOB = 'PID_ジョーカー'
const ANNA = 'PID_アンナ'
const RYOMA = 'PID_リョウマ'
const CAMILLA = 'PID_カミラ'
const KANA = 'PID_カンナ男'

const plan = (extra = {}) => ({ skills: [null, null, null, null, null], reclasses: [], ...extra })

// A run shaped like the Figma mock: Corrin (F) with a Samurai talent, married and paired to Jakob.
const now = '2026-09-30T00:00:00.000Z'
const demoRun = {
  id: 'demo',
  name: 'Revelation — first pass',
  modpackId: 'ugf-2.5.2',
  dlc: true,
  route: 'revelation',
  corrin: { gender: 'female', builds: { female: { boon: 'spd', bane: 'lck', talentClassId: 34 }, male: { boon: 'spd', bane: 'lck', talentClassId: 33 } } },
  favourites: [CORRIN, ANNA],
  units: {
    [CORRIN]: plan({
      sPartner: JAKOB, pairPartner: JAKOB, pairRole: 'front', aPlusPartner: ANNA,
      skills: [53, 59, 21, 30, 43],
      reclasses: [{ segment: 0, level: 10, classId: 34 }, { segment: 0, level: 12, classId: 32 }, { segment: 1, level: 15, classId: 36 }],
    }),
    [JAKOB]: plan({ sPartner: CORRIN, pairPartner: CORRIN, pairRole: 'back', skills: [53, 59, 21, null, null] }),
    [ANNA]: plan({ aPlusPartner: CORRIN }),
    [RYOMA]: plan({ sPartner: CAMILLA, pairPartner: CAMILLA, pairRole: 'front', skills: [57, 58, null, null, null] }),
    [CAMILLA]: plan({ sPartner: RYOMA, pairPartner: RYOMA, pairRole: 'back' }),
  },
  createdAt: now,
  updatedAt: now,
}
const seeded = JSON.stringify({ state: { schema: 5, runs: [demoRun], activeRunId: 'demo', onboarded: true }, version: 5 })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hardStop = setTimeout(() => {
  console.error('shots: hard timeout, exiting')
  process.exit(1)
}, 180000)
hardStop.unref()

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  let page
  let count = 0
  const errors = []

  const settle = async () => {
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await sleep(500)
  }
  const shot = async (name, { full = false } = {}) => {
    await settle()
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full, timeout: 15000 })
    count += 1
    console.log(`${String(count).padStart(2, '0')}  ${name}`)
  }
  const goto = async (hash) => {
    await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.locator('.screen').first().waitFor({ timeout: 10000 })
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
    await settle()
  }
  const click = async (selector) => {
    await page.locator(selector).first().click({ timeout: 5000 })
    await sleep(300)
  }
  const open = async (viewport, { seed = true } = {}) => {
    page = await browser.newPage({ viewport, colorScheme: 'light', serviceWorkers: 'block' })
    page.setDefaultTimeout(6000)
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.addInitScript(([key, value, shouldSeed]) => {
      if (shouldSeed && !sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, value)
        sessionStorage.setItem('seeded', '1')
      }
    }, [KEY, seeded, seed])
  }
  const unit = (id, tab) => `unit/${encodeURIComponent(id)}/${tab}`

  // ── mobile ────────────────────────────────────────────────
  await open(MOBILE, { seed: false })
  await page.goto(`${BASE}/#/roster`, { waitUntil: 'domcontentloaded' })
  await page.locator('.new-run').waitFor()
  await shot('m-01-welcome')
  await click('.new-run-foot .btn.primary')
  await click('.route-card[data-route="conquest"]')
  await shot('m-02-new-run-route')
  await click('.new-run-foot .btn.primary')
  await shot('m-03-new-run-corrin')
  await page.close()

  await open(MOBILE)
  await goto('roster')
  await shot('m-10-roster')
  await click('.rail-tabs .rail-item:nth-child(2)')
  await shot('m-11-roster-growths')
  await click('.sort-btn')
  await shot('m-12-sort-sheet')
  await page.keyboard.press('Escape')
  await click('.roster-row .sprite-btn')
  await shot('m-13-class-picker')
  await page.keyboard.press('Escape')
  await click('.roster-row .rel-slot[data-kind="s"]')
  await shot('m-14-character-picker')
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await shot('m-15-roster-children')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('.roster-sticky-head .rail-item', { hasText: 'Expected Final' }).click()
  await sleep(300)
  await shot('m-16-roster-expected-final')

  await goto(unit(CORRIN, 'profile'))
  await shot('m-20-character-profile')
  await shot('m-21-character-profile-full', { full: true })
  await goto(unit(CORRIN, 'avatar'))
  await shot('m-22-character-avatar', { full: true })
  await goto(unit(CORRIN, 'stats'))
  await shot('m-23-character-stats', { full: true })
  await goto(unit(CORRIN, 'progression'))
  await page.locator('.info-btn').nth(11).click()
  await sleep(300)
  await shot('m-24-character-progression', { full: true })
  await goto(unit(CORRIN, 'profile'))
  await click('.skill-list .skill-card:nth-child(2)')
  await shot('m-27-skill-picker')
  await page.keyboard.press('Escape')
  await goto(unit(KANA, 'profile'))
  await shot('m-25-child-profile')
  await goto(unit(KANA, 'progression'))
  await shot('m-26-child-progression')

  await goto('chart')
  await shot('m-30-chart')
  await page.locator('.chart-sticky-head .rail-item', { hasText: 'Full' }).click()
  await shot('m-31-chart-full')
  await page.locator('.chart-sticky-head .rail-item', { hasText: 'Pair Up' }).click()
  await shot('m-32-chart-pair-up')
  await page.locator('.chart-sticky-head .rail-item', { hasText: 'Skills' }).first().click()
  await goto('runs')
  await click('.run-card .icon-btn')
  await shot('m-40-runs')
  await page.close()

  // ── desktop ───────────────────────────────────────────────
  await open(DESKTOP)
  await goto('roster')
  await shot('d-10-roster')
  await goto(unit(CORRIN, 'profile'))
  await shot('d-20-roster-character')
  await goto(unit(CORRIN, 'progression'))
  await shot('d-21-roster-progression')
  await goto('chart')
  await shot('d-30-chart')
  await goto('runs')
  await shot('d-40-runs')
  await page.close()

  await browser.close()
  if (errors.length) {
    console.error(`\n${errors.length} browser error(s):\n${[...new Set(errors)].join('\n')}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
