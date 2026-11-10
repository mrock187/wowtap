import { expect, test, type Page } from '@playwright/test'

async function mapPoint(page: Page, x: number, y: number) {
  return page.getByRole('group', { name: 'Interactive unlabeled map' }).evaluate((svg, point) => {
    const screen = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  }, { x, y })
}

test('starts at the world, pans and zooms, drills down, and keeps the pin on back', async ({ page }, testInfo) => {
  await page.goto('/tests/fixtures/map-harness.html')
  const map = page.getByRole('group', { name: 'Interactive unlabeled map' })
  await expect(page.getByRole('button', { name: 'Open continent map' })).toHaveCount(2)
  await expect(map).toHaveAttribute('viewBox', '0 0 1000 600')
  await expect(map.locator('text, .map-answer-point, .map-answer-line')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('world.png') })

  await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoomed = await map.getAttribute('viewBox')
  expect(zoomed).not.toBe('0 0 1000 600')
  if (testInfo.project.name === 'desktop') {
    const center = await mapPoint(page, 500, 300)
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, -140)
    await expect(map).not.toHaveAttribute('viewBox', zoomed!)
    const before = await map.getAttribute('viewBox')
    await page.mouse.down()
    await page.mouse.move(center.x + 65, center.y + 25, { steps: 5 })
    await page.mouse.up()
    await expect(map).not.toHaveAttribute('viewBox', before!)
    await expect(map.locator('.map-pin')).toHaveCount(0)
  } else {
    const cdp = await page.context().newCDPSession(page)
    const center = await mapPoint(page, 500, 300)
    const touch = (offset: number) => [
      { x: center.x - offset, y: center.y, id: 1 },
      { x: center.x + offset, y: center.y, id: 2 },
    ]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(25) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(60) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(map).not.toHaveAttribute('viewBox', zoomed!)
    await expect(map.locator('.map-pin')).toHaveCount(0)
    await cdp.detach()
  }
  await page.getByRole('button', { name: 'Fit' }).click()
  await page.getByRole('button', { name: 'Open continent map' }).first().click()
  await page.getByRole('button', { name: 'Open zone map' }).click()
  const detail = page.getByRole('button', { name: 'Enter detailed map' })
  await expect(detail).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoneFrame = await map.getAttribute('viewBox')
  await page.screenshot({ path: testInfo.outputPath('zone.png') })
  await detail.click()
  await expect(page.getByLabel('Current map level')).toContainText('Detailed map')
  await expect(map.locator('image')).toHaveAttribute('href', '/maps/citadel.svg')
  await expect(page.getByRole('status')).toHaveCount(0)
  const pin = await mapPoint(page, 260, 208)
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(pin.x, pin.y)
  else await page.mouse.click(pin.x, pin.y)
  const placed = map.locator('.map-pin')
  await expect(placed).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('city.png') })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(map).toHaveAttribute('viewBox', zoneFrame!)
  await expect(placed).toHaveCount(1)
  const originalPin = await placed.getAttribute('transform')
  await map.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(placed).not.toHaveAttribute('transform', originalPin!)
})

test('recovers a failed map asset', async ({ page }) => {
  await page.route('**/maps/world.svg', route => route.abort())
  await page.goto('/tests/fixtures/map-harness.html')
  await expect(page.getByText('This map could not load.')).toBeVisible()
  await page.unroute('**/maps/world.svg')
  await page.getByRole('button', { name: 'Retry map' }).click()
  await expect(page.getByRole('button', { name: 'Open continent map' })).toHaveCount(2)
})
