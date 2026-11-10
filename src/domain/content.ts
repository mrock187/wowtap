import { z } from 'zod'

export const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const buildSchema = z.string().regex(/^\d+\.\d+\.\d+\.\d+$/)
const fraction = z.number().min(0).max(1)
export const pointSchema = z.object({ x: fraction, y: fraction }).strict()
const boundsSchema = z.tuple([fraction, fraction, fraction, fraction])
  .refine(([left, top, right, bottom]) => left < right && top < bottom, 'Bounds must have positive width and height')

const sourceSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  reference: z.string().min(1),
  checkedAt: z.iso.date(),
  build: buildSchema,
}).strict()

const mapKind = z.enum(['world', 'continent', 'zone', 'city'])
const layerSchema = z.object({
  id: idSchema,
  uiMapId: z.number().int().positive().optional(),
  kind: mapKind,
  parentId: idSchema.nullable(),
  bounds: boundsSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  maxZoom: z.number().min(1).max(32),
  image: z.string().regex(/^maps\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(webp|avif|png|jpg|svg)$/),
  rights: z.enum(['approved', 'local-only', 'fixture']),
  source: sourceSchema,
}).strict()

export type Point = z.infer<typeof pointSchema>
export type MapLayer = z.infer<typeof layerSchema>

const parentKind = { continent: 'world', zone: 'continent', city: 'zone' } as const

export const mapManifestSchema = z.object({
  edition: z.literal('wow-forever'),
  version: idSchema,
  build: buildSchema,
  layers: z.array(layerSchema).min(1),
}).strict().superRefine((manifest, context) => {
  const byId = new Map(manifest.layers.map(layer => [layer.id, layer]))
  const ids = new Set<string>()
  const uiIds = new Set<number>()
  const images = new Set<string>()
  const world = manifest.layers.filter(layer => layer.kind === 'world')
  if (world.length !== 1) {
    context.addIssue({ code: 'custom', path: ['layers'], message: 'Expected one world layer' })
  }
  manifest.layers.forEach((layer, index) => {
    function issue(field: string, message: string) {
      context.addIssue({ code: 'custom', path: ['layers', index, field], message })
    }
    if (ids.has(layer.id)) issue('id', 'Duplicate map ID')
    ids.add(layer.id)
    if (layer.uiMapId !== undefined) {
      if (uiIds.has(layer.uiMapId)) issue('uiMapId', 'Duplicate client UI map ID')
      uiIds.add(layer.uiMapId)
    }
    if (images.has(layer.image)) issue('image', 'Duplicate map image')
    images.add(layer.image)
    if (layer.source.build !== manifest.build) issue('source', 'Map source build differs from atlas build')
    if (layer.kind === 'world') {
      if (layer.parentId !== null) issue('parentId', 'The world has no parent')
      if (layer.bounds.some((value, position) => value !== [0, 0, 1, 1][position])) {
        issue('bounds', 'World bounds must cover its entire coordinate space')
      }
    } else if (!layer.parentId || byId.get(layer.parentId)?.kind !== parentKind[layer.kind]) {
      issue('parentId', `Expected a ${parentKind[layer.kind]} parent`)
    }
  })
})

const polygonSchema = z.array(pointSchema).min(3).refine(points => {
  const vertices = new Set(points.map(({ x, y }) => `${x},${y}`))
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0)
  return vertices.size === points.length && Math.abs(area) > Number.EPSILON
}, 'Polygon vertices must be distinct and enclose a nonzero area')

const answerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point'), point: pointSchema }).strict(),
  z.object({ kind: z.literal('polygon'), vertices: polygonSchema }).strict(),
])

const locationSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
  category: z.enum(['city', 'landmark', 'settlement', 'dungeon-entrance', 'npc']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  mapId: idSchema,
  answers: z.array(answerSchema).min(1),
  precision: z.enum(['standard', 'city']),
  explanation: z.string().trim().min(1),
  source: sourceSchema,
  confidence: z.literal('verified'),
}).strict()

export const locationDatasetSchema = z.object({
  edition: z.literal('wow-forever'),
  version: idSchema,
  atlasVersion: idSchema,
  build: buildSchema,
  locations: z.array(locationSchema),
}).strict().superRefine((dataset, context) => {
  const ids = new Set<string>()
  const names = new Set<string>()
  dataset.locations.forEach((location, index) => {
    function issue(field: string, message: string) {
      context.addIssue({ code: 'custom', path: ['locations', index, field], message })
    }
    const name = location.name.normalize('NFKC').toLowerCase()
    if (ids.has(location.id)) issue('id', 'Duplicate location ID')
    if (names.has(name)) issue('name', 'Ambiguous or duplicate prompt name')
    if (dataset.build !== location.source.build) issue('source', 'Location source build differs from dataset build')
    const answers = new Set(location.answers.map(answer => JSON.stringify(answer)))
    if (answers.size !== location.answers.length) issue('answers', 'Duplicate answer geometry')
    ids.add(location.id)
    names.add(name)
  })
})

export const contentSchema = z.object({
  atlas: mapManifestSchema,
  dataset: locationDatasetSchema,
}).strict().superRefine(({ atlas, dataset }, context) => {
  if (dataset.atlasVersion !== atlas.version || dataset.build !== atlas.build) {
    context.addIssue({ code: 'custom', path: ['dataset'], message: 'Location dataset must target the exact atlas version and build' })
  }
  const maps = new Map(atlas.layers.map(layer => [layer.id, layer]))
  dataset.locations.forEach((location, index) => {
    const map = maps.get(location.mapId)
    if (!map || map.kind === 'world' || (location.precision === 'city' && map.kind !== 'city')) {
      context.addIssue({
        code: 'custom',
        path: ['dataset', 'locations', index, 'mapId'],
        message: 'Answer requires a known landmass map, with a city layer for city precision',
      })
    }
  })
})

export type Answer = z.infer<typeof answerSchema>
export type Location = z.infer<typeof locationSchema>
export type LocationDataset = z.infer<typeof locationDatasetSchema>
export type MapManifest = z.infer<typeof mapManifestSchema>
export type Content = z.infer<typeof contentSchema>
