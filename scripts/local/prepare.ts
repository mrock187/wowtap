import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { freezeSchedule, parseSchedule, utcDate } from '../../src/engine/schedule'
import { art, artUrl, createLocalContent, sourceData } from './content'
import { prepareTerrain } from './terrain'

const dir = new URL('../../.local/forever/', import.meta.url)
const cache = new URL('../../.local/source-review/', import.meta.url)

async function file(url: string, sha: string, cacheName: string) {
  const cached = await readFile(new URL(cacheName, cache)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  let data = cached
  if (!data) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Source download returned HTTP ${response.status}`)
    data = Buffer.from(await response.arrayBuffer())
  }
  if (createHash('sha256').update(data).digest('hex') !== sha) throw new Error(`Unexpected source checksum: ${url}`)
  return data
}

const raw = await file(sourceData.url, sourceData.sha, 'world-map.json')
const upstream: unknown = JSON.parse(raw.toString('utf8'))
const content = createLocalContent(upstream)
const images = await Promise.all(art.map(plate => file(artUrl(plate), plate.sha, `clean-${plate.uiMapId}.png`)))
const scheduleFile = new URL('schedule.json', dir)
const existing = await readFile(scheduleFile, 'utf8').catch((error: NodeJS.ErrnoException) => {
  if (error.code !== 'ENOENT') throw error
})
const schedule = existing
  ? parseSchedule(JSON.parse(existing))
  : freezeSchedule(content, {
    startDate: utcDate(new Date()), version: content.dataset.version, days: 730, requestedCooldownDays: 12,
  })
const latest = schedule.seasons.at(-1)!
if (latest.content.dataset.version !== content.dataset.version) throw new Error('Local schedule is for a different source revision')
await mkdir(new URL('maps/', dir), { recursive: true })
for (const [index, plate] of art.entries()) {
  await writeFile(new URL(`maps/${plate.uiMapId}.png`, dir), images[index])
}
if (!existing) await writeFile(scheduleFile, JSON.stringify(schedule) + '\n', { flag: 'wx' })
await prepareTerrain(upstream)
console.log(`Local Forever ${content.atlas.build}: ${content.atlas.layers.length} plates, ${latest.content.dataset.locations.length} locations, ${latest.cooldownDays}-day minimum repeat gap.`)
