import { describe, expect, it } from 'vitest'
import { createAtlas } from '../../src/domain/atlas'
import { contentSchema } from '../../src/domain/content'
import { coordinateFixture } from '../fixtures/coordinates'

describe('canonical atlas transforms', () => {
  const { atlas } = contentSchema.parse(coordinateFixture)
  const { path, toWorld, fromWorld } = createAtlas(atlas)

  it('maps a known city center through all four levels', () => {
    expect(path('citadel').map(layer => layer.id)).toEqual(['world', 'west', 'highlands', 'citadel'])
    const point = toWorld('citadel', { x: .5, y: .5 })
    expect(point.x).toBeCloseTo(260)
    expect(point.y).toBeCloseTo(210)
    expect(fromWorld('highlands', point).x).toBeCloseTo(.3)
    expect(fromWorld('highlands', point).y).toBeCloseTo(.5)
  })

  it.each(atlas.layers.map(layer => layer.id))('round trips corners and interior coordinates in %s', id => {
    for (const x of [0, .001, .5, 1]) {
      for (const y of [0, .001, .5, 1]) {
        const result = fromWorld(id, toWorld(id, { x, y }))
        expect(result.x).toBeCloseTo(x, 12)
        expect(result.y).toBeCloseTo(y, 12)
      }
    }
  })

  it('keeps out-of-layer points outside on inverse projection', () => {
    expect(fromWorld('citadel', { x: 0, y: 0 }).x).toBeLessThan(0)
  })
})

describe('Forever content validation', () => {
  it('rejects mismatched source builds, unknown maps, and guessed coordinates', () => {
    const candidate = structuredClone(coordinateFixture)
    candidate.dataset.build = '1.60.1.70245'
    candidate.dataset.locations[0].mapId = 'missing'
    candidate.dataset.locations[0].answers = [{ kind: 'point', point: { x: -1, y: 0 } }]
    const result = contentSchema.safeParse(candidate)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map(issue => issue.path.at(-1))).toContain('x')
  })

  it('rejects broken hierarchy, duplicate locations, and empty rectangles', () => {
    const candidate = structuredClone(coordinateFixture)
    candidate.atlas.layers[3].parentId = 'citadel'
    candidate.atlas.layers[3].bounds = [0, 0, 0, 1]
    candidate.dataset.locations.push(candidate.dataset.locations[0])
    const result = contentSchema.safeParse(candidate)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.at(-1))).toEqual(
        expect.arrayContaining(['parentId', 'id', 'bounds']),
      )
    }
  })
})
