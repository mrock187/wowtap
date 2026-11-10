import { expect, test, type Page } from '@playwright/test'
import { createAtlas } from '../../src/domain/atlas'
import { freezeSchedule, readPuzzle } from '../../src/engine/schedule'
import { JOURNAL_KEY } from '../../src/storage/journal'
import { gameFixture, qaDate } from '../fixtures/game'

const puzzle = readPuzzle(freezeSchedule(gameFixture, {
  startDate: '2026-11-01', days: 60, version: 'local-qa',
}), qaDate)!
const atlas = createAtlas(puzzle.atlas)

const guessMap = (page: Page) => page.getByRole('group', { name: 'Interactive unlabeled map' })
const confirm = (page: Page) => page.getByRole('button', { name: 'Confirm pin' })

async function openExpedition(page: Page) {
  await page.clock.setFixedTime(new Date(qaDate + 'T12:00:00Z'))
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

async function placeAnswer(page: Page, round: number, mobile: boolean) {
  const target = puzzle.rounds[round]
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
