import { randomUUID } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'
import { auditLocationContent } from '../data/audit'
import { readJson } from '../data/read-json'
import { contentSchema } from '../../src/domain/content'
import { freezeSchedule, parseSchedule } from '../../src/engine/schedule'

const directory = new URL('../../public/game/', import.meta.url)
const path = new URL('schedule.json', directory)
const [startDate, version, count = '730', ...extra] = process.argv.slice(2)

if (!startDate || !version || extra.length) {
  throw new Error('Usage: npm run schedule:freeze -- YYYY-MM-DD season-version [days]')
}

const [atlas, dataset, existing] = await Promise.all([
  readJson(new URL('atlas.json', directory)),
  readJson(new URL('locations.json', directory)),
  readJson(path, true),
])
const content = contentSchema.parse({ atlas, dataset })
const audit = auditLocationContent(atlas, dataset)
if (audit.blockers.length) throw new Error(audit.blockers.join('. '))
if (content.atlas.layers.some(layer => layer.rights !== 'approved' || !layer.assetSha256 || layer.source.build.startsWith('0.'))) {
  throw new Error('An official season requires release-approved, hashed Forever images')
}
const previous = existing === undefined ? undefined : parseSchedule(existing)
const schedule = freezeSchedule(content, { startDate, version, days: Number(count) }, previous)
const digests = new Map<string, string>()
for (const season of schedule.seasons) {
  for (const layer of season.content.atlas.layers) {
    if (!layer.assetSha256) throw new Error(`Missing historical atlas digest: ${layer.image}`)
    const digest = digests.get(layer.image)
    if (digest && digest !== layer.assetSha256) throw new Error(`Use a new path for changed atlas image: ${layer.image}`)
    digests.set(layer.image, layer.assetSha256)
  }
}
const temp = new URL(`.schedule-${randomUUID()}.json`, directory)
try {
  await writeFile(temp, JSON.stringify(schedule) + '\n', { flag: 'wx' })
  await rename(temp, path)
} finally {
  await rm(temp, { force: true })
}
console.log(`Froze season ${version} from ${startDate}, ${count} days. Previously published seasons preserved.`)
