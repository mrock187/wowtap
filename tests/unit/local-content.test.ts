import { describe, expect, it } from 'vitest'
import { worldProjection } from '../../src/components/map/worldProjection'
import { createAtlas } from '../../src/domain/atlas'
import { build, createLocalContent } from '../../scripts/local/content'

const source = {
  build,
  frame: { width: 1002, height: 668 },
  maps: [
    { id: 947, rect: [0, 0, 1002, 668] },
    { id: 1414, rect: [-186.28, 45.21, 635.39, 592.99] },
    { id: 1415, rect: [372.23, 54.44, 1161.45, 580.58] },
  ],
  pois: [
    { name: 'Fixture West', kind: 'town', at: [220, 350], map: 1 },
    { name: 'Fixture East', kind: 'capital', at: [760, 250], map: 0 },
    { name: 'Unreviewed Fixture', kind: 'landmark', at: [770, 250], map: 0 },
  ],
}

describe('local Forever atlas intake', () => {
  it('compresses the overview ocean and round-trips canonical positions on both shores', () => {
    const atlas = createAtlas(createLocalContent(source).atlas)
    const west = atlas.bounds('kalimdor')
    const east = atlas.bounds('eastern-kingdoms')
    const westEdge = west.left + west.width
    const projection = worldProjection(atlas)!
    const toDisplayX = (x: number) => projection.project({ x, y: 0 }).x

    expect(toDisplayX(east.left) - toDisplayX(westEdge)).toBeCloseTo((east.left - westEdge) * .28)
    expect(toDisplayX(westEdge) - toDisplayX(west.left)).toBeCloseTo(west.width)
    expect(toDisplayX(east.left + east.width) - toDisplayX(east.left)).toBeCloseTo(east.width)
    for (const x of [0, west.left, westEdge, (westEdge + east.left) / 2, east.left, east.left + east.width, 1002]) {
      const restored = projection.unproject(projection.project({ x, y: 250 }))
      expect(restored.x).toBeCloseTo(x)
      expect(restored.y).toBe(250)
    }
  })

  it('preserves canonical client coordinates and image registration while cropping overflow', () => {
    const { atlas: manifest, dataset } = createLocalContent(source)
    const atlas = createAtlas(manifest)
    const eastern = atlas.layer('eastern-kingdoms')
    expect(manifest.layers.every(layer => layer.rights === 'local-only')).toBe(true)
    expect(dataset.locations.map(location => location.id)).toEqual(['fixture-west', 'fixture-east'])
    const answer = dataset.locations[1].answers[0]
    expect(answer.kind).toBe('point')
    if (answer.kind !== 'point') return
    expect(atlas.toWorld(eastern.id, answer.point)).toEqual({ x: 760, y: 250 })
    const [left, , right] = eastern.imageCrop!
    const area = atlas.bounds(eastern.id)
    const originalWidth = area.width / (right - left)
    expect(originalWidth).toBeCloseTo(789.22)
    expect(area.left - left * originalWidth).toBeCloseTo(372.23)
  })

  it('rejects an unexpected build, out-of-bounds coordinates, and duplicate prompts', () => {
    expect(() => createLocalContent({ ...source, build: '1.60.1.70888' })).toThrow()
    const at = [500, 350]
    expect(() => createLocalContent({ ...source, pois: [{ ...source.pois[0], at }] })).toThrow(/outside/)
    expect(() => createLocalContent({ ...source, pois: [source.pois[0], source.pois[0]] })).toThrow(/Duplicate/)
  })
})
