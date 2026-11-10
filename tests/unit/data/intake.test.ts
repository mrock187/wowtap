import { describe, expect, it } from 'vitest'
import { auditLocationContent } from '../../../scripts/data/audit'
import { importObservations } from '../../../scripts/data/observations'
import type { Answer, Content, MapManifest, Point } from '../../../src/domain/content'
import { coordinateFixture } from '../../fixtures/coordinates'

function sourceFixture() {
  const content = structuredClone(coordinateFixture)
  const west = content.atlas.layers.find(layer => layer.id === 'west')!
  const east = content.atlas.layers.find(layer => layer.id === 'east')!
  const city = content.atlas.layers.find(layer => layer.id === 'citadel')!
  west.uiMapId = 1414
  east.uiMapId = 1415
  city.uiMapId = 1454
  return content
}

function observations(atlas: MapManifest, answers: Answer[]) {
  const { id, name, category, difficulty, precision, explanation, mapId, source } = coordinateFixture.dataset.locations[0]
  const uiMapId = atlas.layers.find(layer => layer.id === mapId)?.uiMapId
  const first = {
    id, name, category, difficulty, precision, explanation,
    uiMapId,
    answers,
    source: {
      ...source,
      method: 'client-observation',
    },
  }
  return {
    edition: atlas.edition,
    atlasVersion: atlas.version,
    build: atlas.build,
    version: 'observation-qa',
    observations: [first],
  }
}

const square = [{ x: .2, y: .2 }, { x: .6, y: .2 }, { x: .6, y: .6 }, { x: .2, y: .6 }]

describe('Forever observation import', () => {
  it('normalizes client percentages for every point and polygon, including map edges', () => {
    const { atlas } = sourceFixture()
    const polygon = square.map(({ x, y }) => ({ x: x * 100, y: y * 100 }))
    const input = observations(atlas, [
      { kind: 'point', point: { x: 0, y: 100 } },
      { kind: 'point', point: { x: 72.23, y: 18.5 } },
      { kind: 'polygon', vertices: polygon },
    ])
    const result = importObservations(atlas, input)
    expect(result.locations).toMatchObject([{
      id: 'city-example',
      mapId: 'citadel',
      precision: 'city',
      confidence: 'verified',
      answers: [
        { kind: 'point', point: { x: 0, y: 1 } },
        { kind: 'point', point: { x: .7223, y: .185 } },
        { kind: 'polygon', vertices: square },
      ],
      source: { reference: 'client-observation: Synthetic transform fixture' },
    }])
  })

  it('produces deterministic ID order without changing supplied spawns', () => {
    const { atlas } = sourceFixture()
    const input = observations(atlas, [{ kind: 'point', point: { x: 25, y: 25 } }])
    input.observations.unshift({ ...input.observations[0], id: 'z-example', name: 'Fixture second' })
    const before = structuredClone(input)
    expect(importObservations(atlas, input).locations.map(row => row.id)).toEqual(['city-example', 'z-example'])
    expect(input).toEqual(before)
  })

  it('rejects legacy evidence, unmapped UiMaps, out-of-bounds percents and build mismatches', () => {
    const { atlas } = sourceFixture()
    const input = observations(atlas, [{ kind: 'point', point: { x: 25, y: 25 } }])
    const row = input.observations[0]
    for (const invalid of [
      { ...row, source: { ...row.source, method: 'classic-spawn' } },
      { ...row, source: { ...row.source, method: 'ghost-return' } },
      { ...row, uiMapId: 99999 },
      { ...row, answers: [{ kind: 'point', point: { x: 101, y: 25 } }] },
      { ...row, source: { ...row.source, build: '1.15.9.70003' } },
    ]) {
      expect(() => importObservations(atlas, { ...input, observations: [invalid] })).toThrow()
    }
  })
})

describe('location audit', () => {
  function setPolygons(content: Content, ...polygons: Point[][]) {
    content.dataset.locations[0].answers = polygons.map(vertices => ({ kind: 'polygon', vertices }))
  }

  it('counts geometry, region and city coverage, keeping fixtures blocked', () => {
    const { atlas, dataset } = sourceFixture()
    const example = dataset.locations[0]
    example.answers.push({ kind: 'polygon', vertices: square })
    dataset.locations.push({ ...example, id: 'east-settlement', name: 'Fixture settlement', category: 'settlement',
      difficulty: 'easy', mapId: 'east', precision: 'standard', answers: [{ kind: 'point', point: { x: .5, y: .5 } }] })

    const result = auditLocationContent(atlas, dataset)
    expect(result.report).toMatchObject({
      total: 2,
      continents: { east: 1, west: 1 },
      zones: { highlands: 1 },
      categories: { npc: 1, settlement: 1, city: 0 },
      difficulties: { easy: 1, medium: 0, hard: 1 },
      cityNpcs: 1,
      withArea: 1,
      multiAnswer: 1,
    })
    expect(result.blockers).toEqual(['Atlas contains fixture layers', 'A daily requires at least five verified locations'])
  })

  it('identifies missing main-continent coverage', () => {
    const { atlas, dataset } = sourceFixture()
    expect(auditLocationContent(atlas, dataset).blockers).toContain('No verified locations in Eastern Kingdoms (UiMap 1415)')
  })

  it('allows a valid minimum pool when both mainland regions have verified rows', () => {
    const { atlas, dataset } = sourceFixture()
    for (const layer of atlas.layers) layer.rights = 'approved'
    const example = dataset.locations[0]
    for (const index of [1, 2, 3, 4]) {
      dataset.locations.push({
        ...example,
        id: `additional-${index}`,
        name: `Fixture place ${index}`,
        mapId: 'east',
        precision: 'standard',
        answers: [{ kind: 'point', point: { x: .1 * index, y: .5 } }],
      })
    }
    expect(auditLocationContent(atlas, dataset).blockers).toEqual([])
  })

  it('rejects self-crossing geometry even when its signed area is nonzero', () => {
    const content = sourceFixture()
    setPolygons(content, [{ x: .1, y: .1 }, { x: .9, y: .9 }, { x: .2, y: .8 }, { x: .8, y: .1 }])
    expect(() => auditLocationContent(content.atlas, content.dataset)).toThrow('self-intersecting')
  })

  it('rejects duplicate geometry given with a different vertex origin and winding', () => {
    const content = sourceFixture()
    setPolygons(content, square, [square[2], square[1], square[0], square[3]])
    expect(() => auditLocationContent(content.atlas, content.dataset)).toThrow('duplicate answer polygon')
  })
})
