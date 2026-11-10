import { describe, expect, it } from 'vitest'
import { createAtlas } from '../../../src/domain/atlas'
import type { Location, Point } from '../../../src/domain/content'
import { MAX_ROUND_POINTS, scoreGuess } from '../../../src/engine/scoring'
import { coordinateFixture } from '../../fixtures/coordinates'

const atlas = createAtlas(coordinateFixture.atlas)
const target = coordinateFixture.dataset.locations[0]
const middle = { x: .5, y: .5 }
const worldTarget = atlas.toWorld(target.mapId, middle)

describe('canonical round scoring', () => {
  it('keeps atlas error invariant across map layers and caps coarse city guesses', () => {
    const layers = ['world', 'west', 'highlands', 'citadel']
    const points = [3000, 3500, 4000, MAX_ROUND_POINTS]
    layers.forEach((mapId, index) => {
      const point = atlas.fromWorld(mapId, worldTarget)
      const scored = scoreGuess(atlas, target, { mapId, point })
      expect(scored.error).toBeCloseTo(0, 12)
      expect(scored.answer).toEqual(worldTarget)
      expect(scored.points).toBe(points[index])
      expect(scored.precisionCapped).toBe(index < 3)
    })
  })

  it('is independent of hypothetical viewport pixel sizes or zoom', () => {
    const point = { x: .4, y: .3 }
    const location: Location = { ...target, precision: 'standard' }
    const projected = atlas.toWorld('citadel', point)
    const reference = scoreGuess(atlas, location, { mapId: 'citadel', point })
    for (const mapId of ['world', 'west', 'highlands']) {
      const alternate = scoreGuess(atlas, location, { mapId, point: atlas.fromWorld(mapId, projected) })
      expect(alternate.error).toBeCloseTo(reference.error, 12)
      expect(alternate.points).toBe(reference.points)
    }
  })

  it('selects the closest of multiple accepted spawn points', () => {
    const location: Location = {
      ...target,
      answers: [
        { kind: 'point', point: { x: .1, y: .1 } },
        { kind: 'point', point: { x: .8, y: .9 } },
      ],
    }
    const point = { x: .78, y: .87 }
    const selected = scoreGuess(atlas, location, { mapId: 'citadel', point })
    expect(selected.answer).toEqual(atlas.toWorld('citadel', { x: .8, y: .9 }))
    const reverse = scoreGuess(atlas, { ...location, answers: [...location.answers].reverse() }, { mapId: 'citadel', point })
    expect(reverse).toEqual(selected)
  })

  it('accepts polygon interiors and edges and projects outside guesses onto the boundary', () => {
    const vertices: Point[] = [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .8, y: .8 }, { x: .2, y: .8 }]
    const location: Location = { ...target, answers: [{ kind: 'polygon', vertices }] }
    for (const point of [middle, { x: .2, y: .5 }, vertices[2]]) {
      const score = scoreGuess(atlas, location, { mapId: 'citadel', point })
      expect(score.points).toBe(MAX_ROUND_POINTS)
      expect(score.error).toBeCloseTo(0, 12)
    }
    const outside = { x: .1, y: .5 }
    const score = scoreGuess(atlas, location, { mapId: 'citadel', point: outside })
    expect(score.answer.x).toBeCloseTo(atlas.toWorld('citadel', { x: .2, y: .5 }).x)
    expect(score.answer.y).toBeCloseTo(worldTarget.y)
    expect(score.error).toBeCloseTo(8)
  })

  it('is monotonic in error within one layer and bounded to integers between zero and max', () => {
    const location: Location = {
      ...target, mapId: 'west', precision: 'standard', answers: [{ kind: 'point', point: { x: 0, y: 0 } }],
    }
    let previous = MAX_ROUND_POINTS
    for (let step = 0; step <= 100; step++) {
      const p = step / 100
      const result = scoreGuess(atlas, location, { mapId: 'west', point: { x: p, y: p } })
      expect(Number.isInteger(result.points)).toBe(true)
      expect(result.points).toBeGreaterThanOrEqual(0)
      expect(result.points).toBeLessThanOrEqual(previous)
      previous = result.points
    }
    expect(previous).toBe(0)
  })

  it('identifies a different landmass even for a pin placed on the world layer', () => {
    const location: Location = {
      ...target,
      mapId: 'west',
      precision: 'standard',
      answers: [{ kind: 'point', point: { x: 1, y: .5 } }],
    }
    const wrong = { x: 0, y: .5 }
    const otherWorld = atlas.toWorld('east', wrong)
    const world = scoreGuess(atlas, location, { mapId: 'world', point: atlas.fromWorld('world', otherWorld) })
    const east = scoreGuess(atlas, location, { mapId: 'east', point: wrong })
    const sea = scoreGuess(atlas, location, { mapId: 'world', point: { x: .55, y: .5 } })
    expect(east).toEqual(world)
    expect(world.differentContinent).toBe(true)
    expect(world.points).toBeGreaterThan(0)
    expect(world.points).toBeLessThanOrEqual(500)
    expect(sea.differentContinent).toBe(false)
    expect(sea.points).toBeGreaterThan(world.points)
  })

  it('rejects guesses beyond the normalized map rectangle', () => {
    expect(() => scoreGuess(atlas, target, { mapId: 'citadel', point: { x: -1, y: .5 } })).toThrow()
  })
})
