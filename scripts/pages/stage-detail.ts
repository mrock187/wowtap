import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mapManifestSchema } from '../../src/domain/content'

const root = new URL('../../', import.meta.url)
const path = (name: string) => new URL(name, root)
const atlas = mapManifestSchema.parse(JSON.parse(await readFile(path('public/game/atlas.json'), 'utf8')))
const generated = JSON.parse(await readFile(path('.local/terrain/detail/manifest.json'), 'utf8')) as {
  build: string
  records: { id: number; width: number; height: number; sha256: string }[]
}
if (generated.build !== atlas.build) throw new Error('Detail terrain and atlas use different builds')

async function immutable(name: string, bytes: Buffer) {
  const previous = await readFile(path(name)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  if (previous && !previous.equals(bytes)) throw new Error(`Existing detail artifact has different bytes: ${name}`)
  if (!previous) await writeFile(path(name), bytes, { flag: 'wx' })
}

const directory = 'maps/forever-69913-terrain-detail-v1/'
await mkdir(path('public/' + directory), { recursive: true })
const details = []
for (const plate of generated.records) {
  const base = atlas.layers.find(layer => layer.uiMapId === plate.id && layer.kind === 'continent')
  if (!base?.assetSha256) throw new Error(`Missing frozen base terrain for ${plate.id}`)
  const bytes = await readFile(path(`.local/terrain/detail/${plate.id}.png`))
  if (createHash('sha256').update(bytes).digest('hex') !== plate.sha256) throw new Error('Detail terrain digest mismatch')
  const image = `${directory}${plate.id}.png`
  await immutable('public/' + image, bytes)
  details.push({ base: base.assetSha256, image, width: plate.width, height: plate.height, sha256: plate.sha256 })
  console.log(`${image} ${plate.width}×${plate.height} ${bytes.length} bytes ${plate.sha256}`)
}
await immutable('src/content/terrainDetail.json', Buffer.from(JSON.stringify(details, null, 2) + '\n'))
