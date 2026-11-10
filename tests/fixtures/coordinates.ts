import type { Content, MapLayer } from '../../src/domain/content'

const build = '0.0.0.1'
const source = { build, checkedAt: '2026-11-10', url: 'https://example.invalid/qa', reference: 'Synthetic transform fixture' }

function layer(id: string, kind: MapLayer['kind'], parentId: string | null, bounds: MapLayer['bounds']): MapLayer {
  return { id, kind, parentId, bounds, width: 1000, height: 600, maxZoom: 8, image: `maps/${id}.svg`, rights: 'fixture', source }
}

export const coordinateFixture: Content = {
  atlas: {
    edition: 'wow-forever',
    version: 'coordinates-qa',
    build,
    layers: [
      layer('world', 'world', null, [0, 0, 1, 1]),
      layer('west', 'continent', 'world', [.1, .2, .5, .8]),
      layer('highlands', 'zone', 'west', [.25, 0, .75, .5]),
      layer('citadel', 'city', 'highlands', [.1, .25, .5, .75]),
      layer('east', 'continent', 'world', [.6, .1, .9, .9]),
    ],
  },
  dataset: {
    edition: 'wow-forever',
    atlasVersion: 'coordinates-qa',
    version: 'answers-qa',
    build,
    locations: [{
      id: 'city-example',
      name: 'Fixture contact',
      category: 'npc',
      difficulty: 'hard',
      mapId: 'citadel',
      answers: [{ kind: 'point', point: { x: .5, y: .5 } }],
      precision: 'city',
      explanation: 'Coordinate contract fixture.',
      source,
      confidence: 'verified',
    }],
  },
}
