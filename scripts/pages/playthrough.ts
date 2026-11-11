import { chromium, expect, type Locator, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { worldProjection } from '../../src/components/map/worldProjection'
import { detailTerrain } from '../../src/content/terrainDetail'
import { createAtlas } from '../../src/domain/atlas'
import type { Point } from '../../src/domain/content'
import { parseSchedule, readPuzzle, utcDate } from '../../src/engine/schedule'
import { decodeJournal, JOURNAL_KEY } from '../../src/storage/journal'

async function pinAt(page: Page, map: Locator, point: Point, touch: boolean) {
  await map.scrollIntoViewIfNeeded()
  const screen = await map.evaluate((svg, point) => {
    const position = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!)
    return { x: position.x, y: position.y }
  }, point)
  if (touch) await page.touchscreen.tap(screen.x, screen.y)
  else await page.mouse.click(screen.x, screen.y)
}

async function readPending(page: Page, date: string) {
  const raw = await page.evaluate(key => localStorage.getItem(key), JOURNAL_KEY)
  return decodeJournal(raw)[date]?.pending
}

const target = process.argv[2]
if (!target) throw new Error('Usage: tsx scripts/pages/playthrough.ts https://host/project/')
const site = new URL(target.endsWith('/') ? target : target + '/')
const browser = await chromium.launch()
try {
  await mkdir(new URL('../../.local/published/', import.meta.url), { recursive: true })
  for (const [name, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['wide-desktop', { width: 1920, height: 1080 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    const context = await browser.newContext({ viewport: size, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
    const page = await context.newPage()
    const issues: string[] = []
    page.on('pageerror', error => issues.push(error.message))
    page.on('console', message => { if (message.type() === 'error') issues.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) issues.push(response.url()) })
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) issues.push(request.url())
    })
    const response = await page.request.get(new URL('game/schedule.json', site).href)
    if (!response.ok()) throw new Error(`Published schedule HTTP ${response.status()}`)
    const schedule = parseSchedule(await response.json())
    const daily = readPuzzle(schedule, utcDate(new Date()))
    if (!daily) throw new Error('Published site has no current UTC puzzle')
    const atlas = createAtlas(daily.atlas)
    const projection = worldProjection(atlas)
    const overview = projection?.bounds ?? atlas.bounds(atlas.world.id)
    await page.goto(site.href)
    if (await page.title() !== 'WoWtap') throw new Error('Unexpected page title')
    if (name === 'desktop') {
      await page.getByRole('button', { name: 'Begin expedition' }).waitFor()
      await page.screenshot({ path: fileURLToPath(new URL('../../.local/published/lobby.png', import.meta.url)), fullPage: true })
    }
    await page.getByRole('button', { name: 'Begin expedition' }).click()
    for (const [index, location] of daily.rounds.entries()) {
      const map = page.getByRole('group', { name: 'Interactive unlabeled map' })
      await page.getByRole('heading', { level: 1, name: location.name, exact: true }).waitFor()
      const expected = `0 0 ${overview.width} ${overview.height}`
      if (await map.getAttribute('viewBox') !== expected) throw new Error('Round did not reset to the whole world')
      if (await map.locator('.map-answer-point, .map-answer-line, text').count()) throw new Error('Answer overlay visible before confirmation')
      if (index === 0) {
        await page.getByRole('button', { name: 'Open continent map' }).first().waitFor()
        const box = await map.boundingBox()
        if (!box || box.width < size.width * .95) throw new Error('Map viewport has excessive side gutters')
        if (name !== 'mobile' && box.height < size.height * .73) throw new Error('Desktop map viewport is too short')
        if (!await page.getByRole('button', { name: 'Confirm pin' }).evaluate(button =>
          button.getBoundingClientRect().bottom <= window.innerHeight)) throw new Error('Confirm pin requires scrolling')
        await page.screenshot({ path: fileURLToPath(new URL(`../../.local/published/${name}.png`, import.meta.url)), fullPage: true, scale: 'css' })
        console.log(`${name}: ${Math.round(box.width)} × ${Math.round(box.height)} map viewport at ${size.width} × ${size.height}`)
        if (projection) {
          for (const x of [.25, .53, .79]) {
            const point = { x, y: .28 }
            const display = projection.project(atlas.toWorld(atlas.world.id, point))
            await pinAt(page, map, display, name === 'mobile')
            await expect.poll(async () => {
              const pending = await readPending(page, daily.date)
              if (pending?.mapId !== atlas.world.id) return Infinity
              return Math.hypot(pending.point.x - point.x, pending.point.y - point.y)
            }).toBeLessThan(.008)
          }
        }
      }
      const path = atlas.path(location.mapId)
      for (let depth = 1; depth < path.length; depth++) {
        const child = path[depth]
        const siblings = atlas.children(path[depth - 1].id).filter(layer => layer.kind === child.kind)
        const label = child.kind === 'city' ? 'Enter detailed map' : `Open ${child.kind} map`
        await page.getByRole('button', { name: label }).nth(siblings.findIndex(layer => layer.id === child.id)).click()
        if (projection && child.kind === 'continent') {
          const detail = detailTerrain(child)
          if (index === 0 && detail) {
            await expect(map.locator(`image[href$="${detail.image}"]`)).toHaveAttribute('opacity', '1')
            const box = await map.boundingBox()
            if (!box) throw new Error('Continent map is missing')
            const readView = async () => (await map.getAttribute('viewBox'))!.split(' ').map(Number)
            const bounds = atlas.bounds(child.id)
            const [, , width, height] = await readView()
            if (Math.abs(width / height - box.width / box.height) > .01) throw new Error('Continent viewport is letterboxed')
            if (bounds.width / width < .65) throw new Error('Continent opens too narrow')
            await page.getByRole('button', { name: 'Zoom in' }).click()
            await expect.poll(async () => (await readView())[2]).toBeLessThan(width)
            await page.screenshot({ path: fileURLToPath(new URL(`../../.local/published/${name}-continent-zoom.png`, import.meta.url)), fullPage: true })
          }
          await page.getByRole('button', { name: 'Fit' }).click()
        }
      }
      await page.getByText('Unfolding the map…').waitFor({ state: 'hidden' })
      const answer = location.answers[0]
      if (answer.kind !== 'point') throw new Error('Published play-through expects a point answer')
      const point = atlas.toWorld(location.mapId, answer.point)
      await pinAt(page, map, path.length === 1 && projection ? projection.project(point) : point, name === 'mobile')
      await expect.poll(async () => {
        const pending = await readPending(page, daily.date)
        return pending?.mapId === location.mapId ? Math.hypot(pending.point.x - answer.point.x, pending.point.y - answer.point.y) : pending
      }, { message: `${name} round ${index + 1}: pin at ${location.name}` }).toBeLessThan(.008)
      await page.getByRole('button', { name: 'Confirm pin' }).click()
      await page.getByRole('complementary', { name: 'Round result' }).getByText('5,000', { exact: true }).waitFor()
      await page.getByRole('button', { name: index === 4 ? 'See results' : 'Next round' }).click()
    }
    await page.getByRole('heading', { level: 1, name: '25,000 / 25,000' }).waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'View today’s result' }).waitFor()
    if (issues.length) throw new Error(issues.join('\n'))
    console.log(`PASS ${name}: five rounds, 25,000 points, persisted result, no console/network errors at ${site.href}`)
    await context.close()
  }
} finally {
  await browser.close()
}
