import type { MapLayer, MapManifest, Point } from './content'

type Transform = { left: number; top: number; width: number; height: number }

export function createAtlas(manifest: MapManifest) {
  const layers = new Map(manifest.layers.map(layer => [layer.id, layer]))
  const world = manifest.layers.find(layer => layer.kind === 'world')
  if (!world) throw new Error('Atlas requires a world layer')
  const transforms = new Map<string, Transform>([
    [world.id, { left: 0, top: 0, width: world.width, height: world.height }],
  ])

  function layer(id: string): MapLayer {
    const entry = layers.get(id)
    if (!entry) throw new Error(`Unknown map layer: ${id}`)
    return entry
  }

  function bounds(id: string): Transform {
    const cached = transforms.get(id)
    if (cached) return cached
    const entry = layer(id)
    if (!entry.parentId) throw new Error(`Layer is disconnected from the atlas: ${id}`)
    const parent = bounds(entry.parentId)
    const [left, top, right, bottom] = entry.bounds
    const result = {
      left: parent.left + left * parent.width,
      top: parent.top + top * parent.height,
      width: (right - left) * parent.width,
      height: (bottom - top) * parent.height,
    }
    transforms.set(id, result)
    return result
  }

  function toWorld(id: string, point: Point): Point {
    const { left, top, width, height } = bounds(id)
    return { x: left + point.x * width, y: top + point.y * height }
  }

  function fromWorld(id: string, point: Point): Point {
    const { left, top, width, height } = bounds(id)
    return { x: (point.x - left) / width, y: (point.y - top) / height }
  }

  function path(id: string): MapLayer[] {
    const entry = layer(id)
    return entry.parentId ? [...path(entry.parentId), entry] : [entry]
  }

  function children(id: string): MapLayer[] {
    return manifest.layers.filter(entry => entry.parentId === id)
  }

  return { world, layer, bounds, toWorld, fromWorld, path, children }
}

export type Atlas = ReturnType<typeof createAtlas>
