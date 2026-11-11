import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createAtlas } from '../../src/domain/atlas'
import { parseSchedule, readPuzzle, utcDate } from '../../src/engine/schedule'

const target = process.argv[2]
if (!target) throw new Error('Usage: tsx scripts/pages/playthrough.ts https://host/project/')
const site = new URL(target.endsWith('/') ? target : target + '/')
const browser = await chromium.launch()
try {
  await mkdir(new URL('../../.local/published/', import.meta.url), { recursive: true })
  for (const [name, size] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
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
    await page.goto(site.href)
    if (await page.title() !== 'WoWtap') throw new Error('Unexpected page title')
    await page.getByRole('button', { name: 'Begin expedition' }).click()
    for (const [index, location] of daily.rounds.entries()) {
      const map = page.getByRole('group', { name: 'Interactive unlabeled map' })
      await page.getByRole('heading', { level: 1, name: location.name, exact: true }).waitFor()
      const expected = `0 0 ${atlas.world.width} ${atlas.world.height}`
      if (await map.getAttribute('viewBox') !== expected) throw new Error('Round did not reset to the whole world')
      if (await map.locator('.map-answer-point, .map-answer-line, text').count()) throw new Error('Answer overlay visible before confirmation')
      if (index === 0) {
        await page.getByRole('button', { name: 'Open continent map' }).first().waitFor()
        await page.screenshot({ path: fileURLToPath(new URL(`../../.local/published/${name}.png`, import.meta.url)), fullPage: true, scale: 'css' })
      }
      const path = atlas.path(location.mapId)
      for (let depth = 1; depth < path.length; depth++) {
        const child = path[depth]
        const siblings = atlas.children(path[depth - 1].id).filter(layer => layer.kind === child.kind)
        const label = child.kind === 'city' ? 'Enter detailed map' : `Open ${child.kind} map`
        await page.getByRole('button', { name: label }).nth(siblings.findIndex(layer => layer.id === child.id)).click()
      }
      await page.getByText('Unfolding the map…').waitFor({ state: 'hidden' })
      const answer = location.answers[0]
      if (answer.kind !== 'point') throw new Error('Published play-through expects a point answer')
      const point = atlas.toWorld(location.mapId, answer.point)
      await map.scrollIntoViewIfNeeded()
      const screen = await map.evaluate((svg, point) => {
        const position = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!)
        return { x: position.x, y: position.y }
      }, point)
      if (name === 'mobile') await page.touchscreen.tap(screen.x, screen.y)
      else await page.mouse.click(screen.x, screen.y)
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
