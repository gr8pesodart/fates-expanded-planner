/**
 * Captures every prototype page/state into docs/screenshots/prototype/.
 * Expects a preview server already running (npm run preview -- --port 4173).
 *
 *   npm run shots
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'docs/screenshots/prototype'
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const hardStop = setTimeout(() => {
  console.error('shots: hard timeout, exiting')
  process.exit(1)
}, 120000)
hardStop.unref()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  let page
  let count = 0

  const settle = async () => {
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await sleep(450)
  }

  const shot = async (name, { full = false } = {}) => {
    await settle()
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full, timeout: 15000 })
    count += 1
    console.log(`${String(count).padStart(2, '0')}  ${name}`)
  }

  const goto = async (hash) => {
    await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'domcontentloaded', timeout: 8000 })
    await settle()
  }

  const click = async (selector) => {
    await page.locator(selector).first().click({ timeout: 5000 })
    await sleep(250)
  }

  const open = async (viewport) => {
    page = await browser.newPage({ viewport, colorScheme: 'light', serviceWorkers: 'block' })
    page.setDefaultTimeout(5000)
    await goto('pairings')
  }

  // ── mobile 390x844 ────────────────────────────────────────
  await open(MOBILE)

  await goto('setup')
  await shot('setup-390')
  await shot('setup-390-full', { full: true })

  await goto('pairings')
  await shot('pairings-390')
  await shot('pairings-390-full', { full: true })

  await page.locator('.unit', { hasText: 'Ryoma' }).first().locator('.pinbtn').click()
  await page.locator('.unit', { hasText: 'Camilla' }).first().locator('.pinbtn').click()
  await sleep(300)
  await shot('pairings-pinned-390')

  await click('.pair .who .chipbtn')
  await shot('partner-sheet-390')
  await click('.sheet .closebtn')

  await page.locator('.searchbar input').fill('zzz no such unit')
  await shot('pairings-filtered-empty-390')
  await page.locator('.searchbar input').fill('')
  await sleep(150)

  await goto('unit/PID_シノノメ')
  await shot('unit-shiro-390')
  await shot('unit-shiro-390-full', { full: true })

  await page.locator('.classfoot .chipbtn').nth(0).click()
  await page.locator('.classfoot .chipbtn').nth(1).click()
  await page.locator('[data-testid="class-compare"]').scrollIntoViewIfNeeded()
  await shot('unit-shiro-class-compare-390')

  await page.locator('.skillslots .skill').nth(4).click()
  await shot('skill-sheet-390')
  await click('.sheet .closebtn')

  await goto('unit/PID_シノノメ/route')
  await shot('route-shiro-390')
  await shot('route-shiro-390-full', { full: true })
  await click('.addstop')
  await shot('add-stop-sheet-390')

  await goto('preview')
  await shot('preview-390')
  await shot('preview-390-full', { full: true })

  await page.close()

  // ── desktop 1280x800 ──────────────────────────────────────
  await open(DESKTOP)
  await goto('setup')
  await shot('setup-1280')

  await goto('pairings')
  await shot('pairings-1280')

  await goto('unit/PID_シノノメ')
  await shot('unit-shiro-1280')

  await goto('unit/PID_リョウマ')
  await shot('unit-ryoma-1280')

  await goto('unit/PID_シノノメ/route')
  await shot('route-shiro-1280')

  await goto('preview')
  await shot('preview-1280')

  await page.close()
  await browser.close()
  console.log(`done: ${count} shots`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
