import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseSchedule } from '../../src/engine/schedule'
import { contentSchema } from '../../src/domain/content'
import { build } from '../local/content'

const root = new URL('../../', import.meta.url)
const path = (file: string) => new URL(file, root)
const local = parseSchedule(JSON.parse(await readFile(path('.local/forever/schedule.json'), 'utf8')))
const terrain = JSON.parse(await readFile(path('.local/terrain/derived/manifest.json'), 'utf8')) as {
  build: string
  records: { id: number; width: number; height: number; sha256: string }[]
}
if (terrain.build !== build) throw new Error('Terrain source build mismatch')

const published = structuredClone(local)
const images = new Map<string, Buffer>()
for (const season of published.seasons) {
  for (const layer of season.content.atlas.layers) {
    const plate = terrain.records.find(record => record.id === layer.uiMapId)
    if (!plate) throw new Error(`No terrain render for ${layer.id}`)
    const image = await readFile(path(`.local/terrain/derived/${plate.id}.png`))
    if (createHash('sha256').update(image).digest('hex') !== plate.sha256) throw new Error('Terrain digest mismatch')
    layer.image = `maps/forever-69913-terrain-v1/${plate.id}.png`
    layer.assetSha256 = plate.sha256
    layer.imageWidth = plate.width
    layer.imageHeight = plate.height
    layer.rights = 'user-authorized'
    layer.source = {
      build,
      checkedAt: '2026-11-10',
      url: plate.id === 947
        ? `https://wago.tools/db2/Map/csv?build=${build}`
        : `https://wago.tools/api/casc/${plate.id === 1414 ? 782778 : 775970}?version=${build}`,
      reference: 'Terrain render from build-matched WDL heights and ocean masks. Publication authorized by project owner.',
    }
    images.set(layer.image, image)
  }
  contentSchema.parse(season.content)
}
const frozen = parseSchedule(published)
const directory = path('public/game/')
await mkdir(directory, { recursive: true })
await mkdir(path('public/maps/forever-69913-terrain-v1/'), { recursive: true })

async function immutable(file: URL, data: string | Buffer) {
  const previous = await readFile(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  const next = typeof data === 'string' ? Buffer.from(data) : data
  if (previous && !previous.equals(next)) throw new Error(`Published artifact already exists with different bytes: ${file.pathname}`)
  if (!previous) await writeFile(file, next, { flag: 'wx' })
}

for (const [name, bytes] of images) await immutable(path('public/' + name), bytes)
const current = frozen.seasons.at(-1)!.content
await immutable(new URL('atlas.json', directory), JSON.stringify(current.atlas) + '\n')
await immutable(new URL('locations.json', directory), JSON.stringify(current.dataset) + '\n')
await immutable(new URL('schedule.json', directory), JSON.stringify(frozen) + '\n')
console.log(`Staged ${images.size} terrain maps and ${current.dataset.locations.length} locations for WoWtap.`)
for (const [name, bytes] of images) console.log(`${name} ${createHash('sha256').update(bytes).digest('hex')}`)
