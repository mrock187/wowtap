import { z } from 'zod'
import { contentSchema, locationDatasetSchema, mapManifestSchema, type LocationDataset } from '../../src/domain/content'
import { validateAnswerAreas } from './audit'

const percent = z.number().min(0).max(100)
const clientPoint = z.object({ x: percent, y: percent }).strict()
const answer = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point'), point: clientPoint }).strict(),
  z.object({ kind: z.literal('polygon'), vertices: z.array(clientPoint).min(3) }).strict(),
])
const { locations, ...datasetShape } = locationDatasetSchema.shape
const location = locations.element
const observationsSchema = z.object({
  ...datasetShape,
  observations: z.array(location.omit({ mapId: true, confidence: true }).extend({
    uiMapId: z.number().int().positive(),
    answers: z.array(answer).min(1),
    source: location.shape.source.extend({
      method: z.enum(['client-observation', 'reviewed-forever-source']),
    }),
  })),
}).strict()

function normalize(point: z.infer<typeof clientPoint>) {
  return { x: point.x / 100, y: point.y / 100 }
}

export function importObservations(atlasInput: unknown, observationsInput: unknown): LocationDataset {
  const atlas = mapManifestSchema.parse(atlasInput)
  const { observations, ...metadata } = observationsSchema.parse(observationsInput)
  const maps = new Map(atlas.layers.map(layer => [layer.uiMapId, layer.id]))
  const normalized = observations.map(({ uiMapId, answers, source, ...entry }) => {
    const mapId = maps.get(uiMapId)
    if (!mapId) throw new Error(`${entry.id} uses unmapped client UiMap ${uiMapId}`)
    const { method, reference, ...provenance } = source
    return {
      ...entry,
      mapId,
      answers: answers.map(answer => answer.kind === 'point'
        ? { kind: answer.kind, point: normalize(answer.point) }
        : { kind: answer.kind, vertices: answer.vertices.map(normalize) }),
      source: { ...provenance, reference: `${method}: ${reference}` },
      confidence: 'verified' as const,
    }
  })
  normalized.sort((first, second) => first.id < second.id ? -1 : Number(first.id > second.id))
  const { dataset } = contentSchema.parse({ atlas, dataset: { ...metadata, locations: normalized } })
  validateAnswerAreas(dataset.locations)
  return dataset
}
