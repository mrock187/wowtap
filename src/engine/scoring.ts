import type { Atlas } from '../domain/atlas'
import { pointSchema, type Location, type MapLayer, type Point } from '../domain/content'

export type Guess = { mapId: string; point: Point }
export type RoundScore = {
  points: number
  error: number
  answer: Point
  differentContinent: boolean
  precisionCapped: boolean
}

export const MAX_ROUND_POINTS = 5000
const CITY_PRECISION_CAP: Record<MapLayer['kind'], number> = {
  world: 3000,
  continent: 3500,
  zone: 4000,
  city: 4000,
}
const BOUNDARY_TOLERANCE = 1e-12

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function nearestOnEdge(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denominator = dx * dx + dy * dy
  if (denominator === 0) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / denominator))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

function nearestOnPolygon(point: Point, vertices: Point[]): Point {
  let inside = false
  let best = vertices[0]
  let bestDistance = distance(point, best)
  vertices.forEach((a, index) => {
    const b = vertices[(index + 1) % vertices.length]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + (b.x - a.x) * (point.y - a.y) / (b.y - a.y)) {
      inside = !inside
    }
    const near = nearestOnEdge(point, a, b)
    const error = distance(point, near)
    if (error < bestDistance) {
      best = near
      bestDistance = error
    }
  })
  return inside ? point : best
}

function contains(atlas: Atlas, layer: MapLayer, world: Point): boolean {
  const p = atlas.fromWorld(layer.id, world)
  return p.x >= -BOUNDARY_TOLERANCE && p.x <= 1 + BOUNDARY_TOLERANCE
    && p.y >= -BOUNDARY_TOLERANCE && p.y <= 1 + BOUNDARY_TOLERANCE
}

export function scoreGuess(atlas: Atlas, location: Location, guess: Guess): RoundScore {
  const guessedLayer = atlas.layer(guess.mapId)
  const worldGuess = atlas.toWorld(guess.mapId, pointSchema.parse(guess.point))
  const targetContinent = atlas.path(location.mapId)[1]
  const guessContinent = atlas.path(guess.mapId)[1]
  const differentContinent = guessContinent
    ? guessContinent.id !== targetContinent.id
    : !contains(atlas, targetContinent, worldGuess)
      && atlas.children(atlas.world.id).some(layer => contains(atlas, layer, worldGuess))

  const nearest = location.answers.reduce<{ answer: Point; error: number } | undefined>((best, accepted) => {
    const answer = accepted.kind === 'point'
      ? atlas.toWorld(location.mapId, accepted.point)
      : nearestOnPolygon(worldGuess, accepted.vertices.map(vertex => atlas.toWorld(location.mapId, vertex)))
    const error = distance(worldGuess, answer)
    return !best || error < best.error ? { answer, error } : best
  }, undefined)
  if (!nearest) throw new Error('A location requires at least one accepted answer')

  const radius = Math.hypot(atlas.world.width, atlas.world.height) / 4
  const target = atlas.bounds(location.mapId)
  const tolerance = Math.hypot(target.width, target.height) * .003
  const accuracy = Math.max(0, 1 - Math.max(0, nearest.error - tolerance) / (radius - tolerance))
  const geographicPoints = Math.round(MAX_ROUND_POINTS * accuracy ** 2)
  const regionPoints = differentContinent ? Math.min(500, Math.round(geographicPoints * .2)) : geographicPoints
  const cap = location.precision === 'city' && guess.mapId !== location.mapId
    ? CITY_PRECISION_CAP[guessedLayer.kind]
    : MAX_ROUND_POINTS
  return {
    ...nearest,
    points: Math.min(regionPoints, cap),
    differentContinent,
    precisionCapped: regionPoints > cap,
  }
}
