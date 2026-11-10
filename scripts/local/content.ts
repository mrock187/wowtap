import { z } from 'zod'
import { contentSchema, type Content, type Location, type MapLayer } from '../../src/domain/content'

export const dataRevision = 'd5259f6dfec9016e6a2d26f94a8d58cf577438ca'
export const artRevision = 'd6cdee5569f5ac458b87ae5908730ee4c73e60d5'
export const build = '1.60.1.69913'
const version = 'forever-beta-local'
const dataUrl = `https://raw.githubusercontent.com/peligwen/peligaming/${dataRevision}/public/tools/wow-forever/data/world-map/world-map.json`
const artRoot = `https://raw.githubusercontent.com/openmap-world/openmap/${artRevision}/art/edits/edited/`

export const sourceData = {
  url: dataUrl, sha: '6616b7813bd3b5c5183b7fb6ebf08f468240195f3f104d733f124cc07c1d0c40',
}
export const art = [
  { uiMapId: 947, map: null, name: 'Azeroth', id: 'azeroth', bounds: [0, 0, 1002, 668], sha: '1fb2a703cc1b36ca5895e5479ed79e8583968f29638131dbf0ef3dc1c40852c1' },
  { uiMapId: 1414, map: 1, name: 'Kalimdor', id: 'kalimdor', bounds: [60, 47, 432, 592], sha: '494b2d8c7d4bacf2a1f46b9303580e9f943efd3b538958c57241961c48ee796b' },
  { uiMapId: 1415, map: 0, name: 'Eastern Kingdoms', id: 'eastern-kingdoms', bounds: [627, 55, 943, 580], sha: 'a10f3873a50c1a238d680417e76731c29203e75307f11a3288f32850819308f5' },
] as const

export function artUrl(plate: typeof art[number]) {
  return artRoot + encodeURIComponent(`${plate.uiMapId} ${plate.name}.png`)
}

const point = z.tuple([z.number(), z.number()])
const rect = z.tuple([z.number(), z.number(), z.number(), z.number()])
const sourceSchema = z.object({
  build: z.literal(build),
  frame: z.object({ width: z.literal(1002), height: z.literal(668) }),
  maps: z.array(z.object({ id: z.number(), rect })),
  pois: z.array(z.object({
    name: z.string(), kind: z.enum(['capital', 'town', 'landmark']), at: point, map: z.number(),
  })),
})

const landmarkNames = new Set([
  'Mirror Lake', "Uther's Tomb", "Tor'kren Farm", "Steelgrill's Depot", 'Echo Ridge Mine',
  'Maclure Vineyards', 'Stonefield Farm', 'Northshire Vineyards', 'Tower of Ilgalar', "Render's Rock",
  'Rethban Caverns', 'Westbrook Garrison', 'Jasperlode Mine', 'Grim Batol', 'Cliffspring Falls',
  'Fray Island', 'Shady Rest Inn', 'North Point Tower', 'Tidefury Cove', 'Stonemaul Ruins',
  "Marshal's Refuge", 'Fungal Rock', 'Wavestrider Beach', 'Mirage Raceway', 'Darkcloud Pinnacle',
  'Ruins of Solarsal', 'Flame Crest', 'Talrendis Point', 'Bloodvenom Post', 'Cragpool Lake',
  "The Ruins of Ordil'Aran", "Bathran's Haunt", 'Forest Song', 'Stormwind Harbor',
  'The Weeping Cave', 'Yojamba Isle', 'Staghelm Point',
])
const easyTowns = new Set([
  'Goldshire', 'Crossroads', 'The Crossroads', 'Booty Bay', 'Ratchet', 'Razor Hill', 'Brill',
  'Darkshire', 'Kharanos', 'Gadgetzan', 'Menethil Harbor', 'Everlook', 'Lakeshire',
])

function slug(name: string) {
  return name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function createLocalContent(raw: unknown): Content {
  const data = sourceSchema.parse(raw)
  const { width, height } = data.frame
  const checkedAt = '2026-11-10'
  const layers: MapLayer[] = art.map(plate => {
    const map = data.maps.find(map => map.id === plate.uiMapId)
    if (!map) throw new Error(`Missing UiMap ${plate.uiMapId}`)
    const [x0, y0, x1, y1] = map.rect
    const [left, top, right, bottom] = plate.bounds
    return {
      id: plate.id, uiMapId: plate.uiMapId, parentId: plate.map === null ? null : 'azeroth',
      kind: plate.map === null ? 'world' : 'continent',
      width, height, maxZoom: 6,
      bounds: [left / width, top / height, right / width, bottom / height],
      imageCrop: [(left - x0) / (x1 - x0), (top - y0) / (y1 - y0), (right - x0) / (x1 - x0), (bottom - y0) / (y1 - y0)],
      image: `maps/${plate.uiMapId}.png`, assetSha256: plate.sha, rights: 'local-only',
      source: { url: artUrl(plate), checkedAt, build, reference: 'OpenMap label-free art registered to the matching UiMap frame' },
    }
  })
  const locations: Location[] = []
  const used = new Set<string>()
  for (const poi of data.pois) {
    if (poi.kind === 'landmark' && !landmarkNames.has(poi.name)) continue
    const plate = art.find(layer => layer.map === poi.map)
    if (!plate) continue
    const id = slug(poi.name)
    if (used.has(id)) throw new Error(`Duplicate reviewed prompt: ${poi.name}`)
    const [left, top, right, bottom] = plate.bounds
    const [x, y] = poi.at
    if (x < left || x > right || y < top || y > bottom) {
      throw new Error(`Point falls outside the selected plate: ${poi.name}`)
    }
    used.add(id)
    const category = poi.kind === 'capital' ? 'city' : poi.kind === 'town' ? 'settlement' : 'landmark'
    const difficulty = poi.kind === 'landmark' ? 'hard' : poi.kind === 'capital' || easyTowns.has(poi.name) ? 'easy' : 'medium'
    locations.push({
      id, name: poi.name, category, difficulty, mapId: plate.id, precision: 'standard',
      answers: [{ kind: 'point', point: { x: (x - left) / (right - left), y: (y - top) / (bottom - top) } }],
      confidence: 'verified',
      explanation: `The Forever client marks this ${category} on ${plate.name === 'Eastern Kingdoms' ? 'the Eastern Kingdoms' : plate.name}.`,
      source: { url: dataUrl, checkedAt, build, reference: 'AreaPOI, transformed by the source UiMapAssignment pipeline' },
    })
  }

  return contentSchema.parse({
    atlas: { edition: 'wow-forever', version, build, layers },
    dataset: { edition: 'wow-forever', version, atlasVersion: version, build, locations },
  })
}
