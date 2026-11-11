import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detailTerrain } from '../../src/content/terrainDetail'
import { contentSchema, type Content } from '../../src/domain/content'
import { parseSchedule, readPuzzle, utcDate } from '../../src/engine/schedule'
import { auditLocationContent } from '../data/audit'
import { readJson } from '../data/read-json'

const maxFiles = 20_000
const maxBytes = 25 * 1024 ** 2
const allowed = /^(index\.html|_headers|favicon\.svg|assets\/[a-zA-Z0-9_-]+\.(js|css)|game\/(atlas|locations|schedule)\.json|maps\/.+)$/

async function inventory(root: string) {
  const files = new Map<string, number>()
  async function scan(directory: string, prefix: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!/^(assets|game|maps)(\/|$)/.test(path)) throw new Error(`Unexpected output directory: ${path}`)
        await scan(fullPath, path + '/')
      } else {
        if (!entry.isFile() || !allowed.test(path)) throw new Error(`Unexpected output file: ${path}`)
        files.set(path, (await lstat(fullPath)).size)
      }
    }
  }
  await scan(root, '')
  return files
}

function ordered(content: Content) {
  const compare = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : 1
  return {
    atlas: { ...content.atlas, layers: [...content.atlas.layers].sort(compare) },
    dataset: { ...content.dataset, locations: [...content.dataset.locations].sort(compare) },
  }
}

async function check(root: string, qa: boolean) {
  const files = await inventory(root)
  const sizes = [...files.values()]
  const largest = sizes.reduce((max, size) => Math.max(max, size), 0)
  const total = sizes.reduce((sum, size) => sum + size, 0)
  console.log(`Pages Free size audit: ${files.size}/${maxFiles} files, largest ${largest}/${maxBytes} bytes, total ${total} bytes.`)
  if (files.size > maxFiles || largest > maxBytes) throw new Error('Cloudflare Pages Free asset limits exceeded')
  if (!files.has('index.html') || !files.has('_headers')) throw new Error('Static entry or Pages headers missing')
  for (const [path] of files) {
    if (!/^assets\/.*\.js$/.test(path)) continue
    const bundle = await readFile(join(root, path), 'utf8')
    if (/coordinates-qa|playthrough-qa|Synthetic transform fixture|Local QA · Fictional/.test(bundle)) {
      throw new Error(`Fixture content in production bundle: ${path}`)
    }
  }

  const [atlas, dataset, rawSchedule] = await Promise.all(
    ['atlas', 'locations', 'schedule'].map(name => readJson(join(root, 'game', name + '.json'), true)),
  )
  const mapFiles = [...files.keys()].filter(path => path.startsWith('maps/'))
  if (atlas === undefined && dataset === undefined && rawSchedule === undefined && mapFiles.length === 0) {
    console.log('Release BLOCKED. No approved Forever atlas, verified locations, or frozen daily schedule in dist.')
    if (!qa) process.exitCode = 2
    return
  }
  if (atlas === undefined || dataset === undefined || rawSchedule === undefined) {
    throw new Error('Incomplete game package. Atlas, locations and schedule are all required.')
  }

  const current = contentSchema.parse({ atlas, dataset })
  const locationAudit = auditLocationContent(atlas, dataset)
  if (locationAudit.blockers.length) throw new Error(locationAudit.blockers.join('. '))
  const schedule = parseSchedule(rawSchedule)
  const last = schedule.seasons.at(-1)!
  if (JSON.stringify(ordered(last.content)) !== JSON.stringify(ordered(current))) {
    throw new Error('Latest frozen season differs from staged atlas or location dataset')
  }
  if (!readPuzzle(schedule, utcDate(new Date()))) throw new Error('Frozen schedule has no puzzle for the current UTC date')

  const publishedImages = new Map<string, string>()
  const displayImages = new Set<string>()
  for (const season of schedule.seasons) {
    const base = season.content.atlas.layers
    const details = base.flatMap(layer => detailTerrain(layer) ?? [])
    for (const layer of details) displayImages.add(layer.image)
    for (const layer of [...base, ...details]) {
      if (!['approved', 'user-authorized'].includes(layer.rights) || !layer.assetSha256 || layer.source.build.startsWith('0.')) {
        throw new Error(`Missing release evidence for ${layer.image}`)
      }
      const previous = publishedImages.get(layer.image)
      if (previous && previous !== layer.assetSha256) throw new Error(`Historical asset path was reused: ${layer.image}`)
      if (!previous) {
        if (!files.has(layer.image)) throw new Error(`Missing frozen atlas image: ${layer.image}`)
        const digest = createHash('sha256').update(await readFile(join(root, layer.image))).digest('hex')
        if (digest !== layer.assetSha256) throw new Error(`Frozen atlas image hash changed: ${layer.image}`)
      }
      publishedImages.set(layer.image, layer.assetSha256)
    }
  }
  if (mapFiles.some(path => !publishedImages.has(path))) throw new Error('Unlisted map image in output')
  console.log(`PASS static package with ${publishedImages.size - displayImages.size} frozen atlas images and ${displayImages.size} detail images.`)
}

const args = process.argv.slice(2)
if (args.length > 1 || (args[0] !== undefined && args[0] !== '--qa')) {
  throw new Error('Usage: tsx scripts/pages/preflight.ts [--qa]')
}
await check(fileURLToPath(new URL('../../dist/', import.meta.url)), args[0] === '--qa').catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
