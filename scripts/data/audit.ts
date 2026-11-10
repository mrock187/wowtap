import { createAtlas } from '../../src/domain/atlas'
import { contentSchema, type Location, type Point } from '../../src/domain/content'

const coreContinents = new Map([[1414, 'Kalimdor'], [1415, 'Eastern Kingdoms']])

function direction(a: Point, b: Point, c: Point) {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
}

function overlaps(a: number, b: number, c: number, d: number) {
  return Math.max(Math.min(a, b), Math.min(c, d)) <= Math.min(Math.max(a, b), Math.max(c, d))
}

function intersects(a: Point, b: Point, c: Point, d: Point) {
  return overlaps(a.x, b.x, c.x, d.x) && overlaps(a.y, b.y, c.y, d.y)
    && direction(a, b, c) * direction(a, b, d) <= 0
    && direction(c, d, a) * direction(c, d, b) <= 0
}

export function validateAnswerAreas(locations: Location[]) {
  for (const location of locations) {
    const polygons = new Set<string>()
    for (const answer of location.answers) {
      if (answer.kind !== 'polygon') continue
      const vertices = answer.vertices
      for (let first = 0; first < vertices.length - 2; first++) {
        for (let second = first + 2; second < vertices.length; second++) {
          if (first === 0 && second === vertices.length - 1) continue
          if (intersects(vertices[first], vertices[first + 1], vertices[second], vertices[(second + 1) % vertices.length])) {
            throw new Error(`${location.id} has a self-intersecting answer polygon`)
          }
        }
      }
      const keys = vertices.map(({ x, y }) => `${x},${y}`)
      const start = keys.indexOf([...keys].sort()[0])
      const forward = [...keys.slice(start), ...keys.slice(0, start)]
      const backward = [forward[0], ...forward.slice(1).reverse()]
      const key = [forward.join(';'), backward.join(';')].sort()[0]
      if (polygons.has(key)) throw new Error(`${location.id} has a duplicate answer polygon`)
      polygons.add(key)
    }
  }
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

export function auditLocationContent(atlasInput: unknown, datasetInput: unknown) {
  const content = contentSchema.parse({ atlas: atlasInput, dataset: datasetInput })
  const { atlas: manifest, dataset } = content
  validateAnswerAreas(dataset.locations)

  const atlas = createAtlas(manifest)
  const categories: Record<Location['category'], number> = {
    city: 0, landmark: 0, settlement: 0, 'dungeon-entrance': 0, npc: 0,
  }
  const difficulties: Record<Location['difficulty'], number> = { easy: 0, medium: 0, hard: 0 }
  const continents = new Map<string, number>()
  const zones = new Map<string, number>()
  const representedUiMaps = new Set<number>()
  let cityNpcs = 0
  let multiAnswer = 0
  let withArea = 0
  for (const location of dataset.locations) {
    categories[location.category]++
    difficulties[location.difficulty]++
    const path = atlas.path(location.mapId)
    const continent = path.find(layer => layer.kind === 'continent')
    const zone = path.find(layer => layer.kind === 'zone')
    if (continent) {
      increment(continents, continent.id)
      if (continent.uiMapId !== undefined) representedUiMaps.add(continent.uiMapId)
    }
    if (zone) increment(zones, zone.id)
    if (location.category === 'npc' && location.precision === 'city') cityNpcs++
    if (location.answers.length > 1) multiAnswer++
    if (location.answers.some(answer => answer.kind === 'polygon')) withArea++
  }

  const blockers: string[] = []
  if (manifest.layers.some(layer => layer.rights === 'fixture')) blockers.push('Atlas contains fixture layers')
  if (dataset.locations.length < 5) blockers.push('A daily requires at least five verified locations')
  for (const [uiMapId, name] of coreContinents) {
    if (!representedUiMaps.has(uiMapId)) blockers.push(`No verified locations in ${name} (UiMap ${uiMapId})`)
  }

  return {
    blockers,
    report: {
      build: dataset.build,
      datasetVersion: dataset.version,
      atlasVersion: dataset.atlasVersion,
      total: dataset.locations.length,
      categories,
      difficulties,
      continents: Object.fromEntries([...continents].sort()),
      zones: Object.fromEntries([...zones].sort()),
      cityNpcs,
      multiAnswer,
      withArea,
    },
  }
}
