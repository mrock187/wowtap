import type { Atlas } from '../../domain/atlas'
import type { Point } from '../../domain/content'

export function worldProjection(atlas: Atlas) {
  if (atlas.world.uiMapId !== 947) return null
  const bounds = atlas.bounds(atlas.world.id)
  const continents = atlas.children(atlas.world.id)
    .filter(layer => layer.kind === 'continent')
    .map(layer => atlas.bounds(layer.id))
    .sort((a, b) => a.left - b.left)
  if (continents.length !== 2) return null
  const [west, east] = continents

  // The Forever world image has a clear ocean strip between these two map extents.
  if (west.left + west.width >= east.left) return null

  const waterStart = west.left + west.width
  const waterEnd = east.left
  const waterScale = .28
  const removed = (waterEnd - waterStart) * (1 - waterScale)
  const displayEnd = waterEnd - removed
  const right = bounds.left + bounds.width

  return {
    bounds: { ...bounds, width: bounds.width - removed },
    strips: [
      { x: bounds.left, width: waterStart - bounds.left, offset: 0, scale: 1 },
      { x: waterStart, width: waterEnd - waterStart, offset: waterStart * (1 - waterScale), scale: waterScale },
      { x: waterEnd, width: right - waterEnd, offset: -removed, scale: 1 },
    ],
    project({ x, y }: Point): Point {
      if (x <= waterStart) return { x, y }
      if (x >= waterEnd) return { x: x - removed, y }
      return { x: waterStart + (x - waterStart) * waterScale, y }
    },
    unproject({ x, y }: Point): Point {
      if (x <= waterStart) return { x, y }
      if (x >= displayEnd) return { x: x + removed, y }
      return { x: waterStart + (x - waterStart) / waterScale, y }
    },
  }
}
