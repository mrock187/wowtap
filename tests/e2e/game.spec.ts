import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createAtlas } from '../../src/domain/atlas'
import { freezeSchedule, readPuzzle, utcDate, type DailyPuzzle } from '../../src/engine/schedule'
import { JOURNAL_KEY } from '../../src/storage/journal'
import { gameFixture, qaDate } from '../fixtures/game'

const fixtureSchedule = freezeSchedule(gameFixture, {
  startDate: '2026-11-01', days: 60, version: 'local-qa',
})
const puzzle = readPuzzle(fixtureSchedule, qaDate)!
const atlas = createAtlas(puzzle.atlas)

const guessMap = (page: Page) => page.getByRole('group', { name: 'Interactive unlabeled map' })
const confirm = (page: Page) => page.getByRole('button', { name: 'Confirm pin' })

async function openExpedition(page: Page, date = qaDate) {
  await page.clock.setFixedTime(new Date(date + 'T12:00:00Z'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin expedition' }).click()
  await expect(guessMap(page)).toHaveAttribute('viewBox', '0 0 1000 600')
}

async function place(page: Page, x: number, y: number, mobile: boolean) {
  const map = guessMap(page)
  await map.scrollIntoViewIfNeeded()
  const point = await map.evaluate((svg, world) => {
    const screen = new DOMPoint(world.x, world.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  }, { x, y })
  if (mobile) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  await expect(confirm(page)).toBeEnabled()
}

async function placeAnswer(page: Page, round: number, mobile: boolean, daily: DailyPuzzle = puzzle) {
  const target = daily.rounds[round]
  const path = atlas.path(target.mapId)
  for (let level = 1; level < path.length; level++) {
    const child = path[level]
    const kind = child.kind
    const siblings = atlas.children(path[level - 1].id).filter(layer => layer.kind === kind)
    const index = siblings.findIndex(layer => layer.id === child.id)
    const name = kind === 'city' ? 'Enter detailed map' : `Open ${kind} map`
    await page.getByRole('button', { name }).nth(index).click()
  }
  await expect(page.getByText('Unfolding the map…')).toHaveCount(0)
  const answer = target.answers[0]
  if (answer.kind !== 'point') throw new Error('Expected point QA fixture')
  const world = atlas.toWorld(target.mapId, answer.point)
  await place(page, world.x, world.y, mobile)
}

test('finishes five rounds, survives refreshes, shares, and opens the next UTC day', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  const issues: string[] = []
  page.on('pageerror', error => issues.push(error.message))
  page.on('response', response => { if (response.status() >= 400) issues.push(response.url()) })
  page.on('request', request => { if (new URL(request.url()).origin !== 'http://127.0.0.1:4174') issues.push(request.url()) })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Clipboard denied')) } })
  })
  await openExpedition(page)
  await expect(page.getByText('Local QA · Fictional atlas and locations')).toBeVisible()
  await expect(confirm(page)).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('game-world.png') })

  for (let round = 0; round < 5; round++) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(puzzle.rounds[round].name)
    await expect(guessMap(page)).toHaveAttribute('viewBox', '0 0 1000 600')
    await expect(guessMap(page).locator('.map-answer-point, .map-answer-line, text')).toHaveCount(0)
    await placeAnswer(page, round, mobile)
    if (round === 0) {
      await page.reload()
      await page.getByRole('button', { name: 'Resume expedition' }).click()
      await expect(confirm(page)).toBeEnabled()
    }
    await confirm(page).click()
    const reveal = page.getByRole('complementary', { name: 'Round result' })
    await expect(reveal.locator('.round-score strong')).toHaveText('5,000')
    await expect(page.getByRole('group', { name: 'Interactive revealed map' }).locator('.map-answer-point')).toHaveCount(1)
    if (round === 0) {
      await page.reload()
      await page.getByRole('button', { name: 'Resume expedition' }).click()
      await expect(reveal.locator('.running-total strong')).toHaveText('5,000 / 25,000')
      await page.screenshot({ path: testInfo.outputPath('game-reveal.png') })
    }
    await page.getByRole('button', { name: round === 4 ? 'See results' : 'Next round' }).click()
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('25,000 / 25,000')
  await page.screenshot({ path: testInfo.outputPath('game-results.png') })
  await page.getByRole('button', { name: 'Share result' }).click()
  await expect(page.getByLabel('Copy your spoiler-free result')).toHaveValue(
    `Azeroth Pinpoint ${qaDate} | 25000/25000 | 🟩🟩🟩🟩🟩`,
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'View today’s result' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Begin expedition' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Journal' }).click()
  await expect(page.getByText('Completed expeditions appear here after their UTC day ends.')).toBeVisible()
  await page.getByRole('button', { name: 'Close journal' }).click()

  await page.clock.setFixedTime(new Date('2026-11-11T00:00:00.000Z'))
  await expect(page.getByRole('button', { name: 'Begin expedition' })).toBeVisible()
  await page.getByRole('button', { name: 'Journal' }).click()
  await expect(page.getByRole('button', { name: 'View result' })).toBeVisible()
  await expect(page.locator('.journal-stats dd')).toHaveText(['1', '1', '1'])
  const saved = await page.evaluate(key => localStorage.getItem(key), JOURNAL_KEY)
  await page.getByRole('button', { name: 'Practice' }).click()
  await expect(page.getByRole('region', { name: 'Practice expedition' })).toBeVisible()
  await place(page, 504, 360, mobile)
  await confirm(page).click()
  expect(await page.evaluate(key => localStorage.getItem(key), JOURNAL_KEY)).toBe(saved)
  expect(issues).toEqual([])
})

test('recovers corrupt storage and runs with browser storage disabled', async ({ page }, testInfo) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, 'corrupt JSON')
    const prototype = Storage.prototype
    prototype.setItem = () => { throw new DOMException('Storage disabled', 'QuotaExceededError') }
  }, JOURNAL_KEY)
  await openExpedition(page)
  await place(page, 500, 320, testInfo.project.name === 'mobile')
  await confirm(page).click()
  await expect(page.getByRole('button', { name: 'Next round' })).toBeVisible()
  await page.getByRole('button', { name: 'Next round' }).click()
  await expect(page.getByText('Round 2 of 5', { exact: false })).toBeVisible()
})

test('supports narrow screens and has no automated accessibility violations', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date(qaDate + 'T12:00:00Z'))
  await page.goto('/')
  const launch = page.getByRole('button', { name: 'Begin expedition' })
  await expect(launch).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cover.png'), scale: 'css' })
  async function audit() {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
  await audit()
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page.getByRole('dialog', { name: 'Read the terrain' })).toBeVisible()
  await audit()
  await page.keyboard.press('Escape')
  await launch.click()
  await expect(guessMap(page)).toBeVisible()
  await audit()
  await guessMap(page).focus()
  await page.keyboard.press('Enter')
  await expect(confirm(page)).toBeEnabled()
  const button = await confirm(page).boundingBox()
  expect(button?.height).toBeGreaterThanOrEqual(44)
})

test('serializes official submissions across tabs and keeps scoring offline', async ({ page, context }) => {
  await openExpedition(page)
  const second = await context.newPage()
  await second.clock.setFixedTime(new Date(qaDate + 'T12:00:00Z'))
  await second.goto('/')
  await second.getByRole('button', { name: 'Resume expedition' }).click()
  const firstMap = guessMap(page)
  await firstMap.focus()
  await page.keyboard.press('Enter')
  await expect(confirm(page)).toBeEnabled()
  await expect(confirm(second)).toBeEnabled()
  await context.setOffline(true)
  const submit = (tab: Page) => tab.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent === 'Confirm pin')
    button?.click()
  })
  await Promise.all([submit(page), submit(second)])
  for (const tab of [page, second]) {
    await expect(tab.getByRole('button', { name: 'Next round' })).toBeVisible()
    const saved = await tab.evaluate(({ key, date }) => JSON.parse(localStorage.getItem(key)!).games[date].guesses.length, {
      key: JOURNAL_KEY, date: qaDate,
    })
    expect(saved).toBe(1)
  }
  await page.getByRole('button', { name: 'Next round' }).click()
  await expect(page.getByText('Round 2 of 5', { exact: false })).toBeVisible()
  await context.setOffline(false)
})

test('scores a detailed city pin after backing out and rejects the wrong landmass', async ({ page }, testInfo) => {
  const season = fixtureSchedule.seasons[0]
  const cityIds = new Set(season.content.dataset.locations.filter(location => location.precision === 'city').map(location => location.id))
  const offset = season.lineups.findIndex(lineup => lineup.some(id => cityIds.has(id)))
  expect(offset).toBeGreaterThanOrEqual(0)
  const date = utcDate(new Date(Date.parse(season.startDate) + offset * 86_400_000))
  const daily = readPuzzle(fixtureSchedule, date)!
  const round = daily.rounds.findIndex(location => location.precision === 'city')
  expect(round).toBeGreaterThan(0)
  const mobile = testInfo.project.name === 'mobile'
  await openExpedition(page, date)

  for (let index = 0; index < round; index++) {
    const targetContinent = atlas.path(daily.rounds[index].mapId)[1]
    const other = atlas.children(atlas.world.id).find(layer => layer.id !== targetContinent.id)!
    const point = atlas.toWorld(other.id, { x: .3, y: .3 })
    await expect(guessMap(page).locator('.map-portal')).toHaveCount(2)
    await place(page, point.x, point.y, mobile)
    await confirm(page).click()
    await expect(page.getByText('Your pin was on a different landmass.')).toBeVisible()
    await page.getByRole('button', { name: 'Next round' }).click()
  }

  await placeAnswer(page, round, mobile, daily)
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(guessMap(page).locator('.map-pin')).toHaveCount(1)
  await page.getByRole('button', { name: 'Enter detailed map' }).click()
  await expect(guessMap(page).locator('.map-pin')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('game-city.png'), fullPage: true, scale: 'css' })
  await confirm(page).click()
  await expect(page.locator('.round-score strong')).toHaveText('5,000')
})
