import { expect, it } from 'vitest'
import { constrain, frameSize } from '../../src/components/map/camera'

it('uses the entire wide viewport and permits panning to both ends of a zoomed continent', () => {
  const bounds = { left: 60, top: 47, width: 372, height: 545 }
  const viewport = { width: 1860, height: 864 }
  const fit = frameSize(bounds, viewport, 1, true)
  expect(fit.height).toBeCloseTo(bounds.height)
  expect(fit.width).toBeGreaterThan(bounds.width)

  const zoom = 3.5
  const view = frameSize(bounds, viewport, zoom, true)
  expect(view.width / view.height).toBeCloseTo(viewport.width / viewport.height)
  expect(view.width).toBeLessThan(bounds.width)
  const frame = { id: 'kalimdor', zoom, center: { x: 0, y: 0 } }
  const north = constrain(frame, bounds, view)
  const south = constrain({ ...frame, center: { x: 1000, y: 1000 } }, bounds, view)
  expect(north.center.x - view.width / 2).toBeCloseTo(bounds.left)
  expect(north.center.y - view.height / 2).toBeCloseTo(bounds.top)
  expect(south.center.x + view.width / 2).toBeCloseTo(bounds.left + bounds.width)
  expect(south.center.y + view.height / 2).toBeCloseTo(bounds.top + bounds.height)
})
